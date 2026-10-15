/**
 * Sesli Okuma Koçu: lines up what the speech recognizer heard with the
 * passage the child is reading. Pure functions only, so the whole thing is
 * unit tested without a microphone.
 *
 * The alignment walks the passage with a forward-only pointer:
 *  - the heard word matches the current word            → doğru, move on
 *  - it repeats one of the last few words (re-reading)  → ignored
 *  - it matches a word a little further ahead           → the words in between are atlandı
 *  - otherwise it is an attempt at the current word      → if the next try matches
 *    (or the tries glued together match, "ke" + "di"), the self-correction is
 *    accepted; if the child moves on, the word is yanlış.
 * Recognizer spelling noise is tolerated with a similarity check.
 */
import { numberWords } from './turkish-numbers';

export type WordStatus = 'pending' | 'correct' | 'wrong' | 'skipped';

/** One word of the passage as shown on screen. */
export interface PassageToken {
  /** As written, with its punctuation: "kedi," */
  display: string;
  /** Normalized for comparisons: "kedi" */
  norm: string;
  /** What a reader says for it: ["yirmi", "üç"] for "23", else [norm]. */
  spoken: string[];
}

/** A spoken word of the passage (a token can have several, e.g. "23"). */
interface SpokenUnit {
  word: string;
  token: number;
}

export interface Passage {
  tokens: PassageToken[];
  units: SpokenUnit[];
}

export interface AlignState {
  /** Index into passage.units of the next word to read. */
  pointer: number;
  /** Per spoken unit. */
  status: WordStatus[];
  /** What was heard for a unit that was misread (attempts glued with a space). */
  heard: (string | null)[];
}

export interface ReadingStats {
  totalWords: number;
  correct: number;
  wrong: number;
  skipped: number;
  /** Words the child has not reached (stopped early). */
  unread: number;
  /** doğru / (doğru + yanlış + atlandı), 0-100. */
  accuracy: number;
  /** Doğru kelime/dakika. */
  wcpm: number;
  durationMs: number;
  /** Passage words marked yanlış or atlandı, unique, in passage order. */
  struggled: string[];
}

/** How far ahead a heard word may jump (skipping the words in between). */
const LOOKAHEAD = 3;
/** Short words ("ve", "bir") are common: they may only skip one word. */
const SHORT_LOOKAHEAD = 1;
/** Re-reading the last few words is not an error. */
const LOOKBEHIND = 3;
const SIMILARITY = 0.75;
/** Hesitation sounds the recognizer sometimes writes out. */
const FILLERS = new Set(['ı', 'ıı', 'ııı', 'ıh', 'ım', 'ımm', 'e', 'ee', 'eee', 'eh', 'hı', 'hım', 'hmm', 'mm', 'aa', 'şey']);

// ---- Normalizing -------------------------------------------------------------

/**
 * Turkish-aware lowercase without punctuation: "İstiklal Marşı’nı!" →
 * "istiklal marşını". Keeps letters, digits and spaces.
 */
export function normalizeTurkish(text: string): string {
  return text
    .normalize('NFC')
    .toLocaleLowerCase('tr')
    .replace(/[’'`´ʼ]/g, '')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Accents removed, for recognizers that drop them: "çocuğu" → "cocugu". */
export function foldTurkish(word: string): string {
  return word
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/ü/g, 'u')
    .replace(/[âà]/g, 'a')
    .replace(/[îì]/g, 'i')
    .replace(/[ûù]/g, 'u');
}

/** 0 → "sıfır", 23 → "yirmi üç", 1920 → "bin dokuz yüz yirmi" (up to 999 999). */
export function numberToWords(n: number): string {
  if (n < 1000) return numberWords(n);
  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;
  const head = thousands === 1 ? 'bin' : `${numberWords(thousands)} bin`;
  return rest ? `${head} ${numberWords(rest)}` : head;
}

/**
 * A normalized word as spoken words: digits become number words, keeping a
 * case suffix on the last word ("23te" → ["yirmi", "üçte"]).
 */
export function spokenForms(word: string): string[] {
  const m = /^(\d+)(\p{L}*)$/u.exec(word);
  if (!m) return [word];
  const n = Number(m[1]);
  if (!Number.isSafeInteger(n) || n > 999_999) return [word];
  const words = numberToWords(n).split(' ');
  words[words.length - 1] += m[2];
  return words;
}

/** Recognized text → the words to align. */
export function heardWords(text: string): string[] {
  return normalizeTurkish(text)
    .split(' ')
    .filter(Boolean)
    .flatMap(spokenForms);
}

// ---- Comparing ---------------------------------------------------------------

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const A = [...a];
  const B = [...b];
  let prev = Array.from({ length: B.length + 1 }, (_, i) => i);
  for (let i = 1; i <= A.length; i++) {
    const cur = [i];
    for (let j = 1; j <= B.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (A[i - 1] === B[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[B.length];
}

/** 1 = same word, 0 = nothing alike. */
export function similarity(a: string, b: string): number {
  const len = Math.max([...a].length, [...b].length);
  return len === 0 ? 1 : 1 - levenshtein(a, b) / len;
}

/**
 * Whether a heard word counts as the expected passage word. Short words
 * (≤ 3 letters) must match exactly; longer ones may differ a little.
 */
export function wordsMatch(heard: string, expected: string): boolean {
  if (heard === expected) return true;
  const h = foldTurkish(heard);
  const e = foldTurkish(expected);
  if (h === e) return true;
  if ([...expected].length <= 3) return false;
  return similarity(h, e) >= SIMILARITY;
}

// ---- Passage -----------------------------------------------------------------

/** Splits a passage into on-screen words; punctuation-only bits stick to the word before. */
export function buildPassage(text: string): Passage {
  const tokens: PassageToken[] = [];
  for (const piece of text.split(/\s+/).filter(Boolean)) {
    const norm = normalizeTurkish(piece).replace(/\s+/g, '');
    if (!norm) {
      if (tokens.length) tokens[tokens.length - 1].display += ` ${piece}`;
      continue;
    }
    tokens.push({ display: piece, norm, spoken: spokenForms(norm) });
  }
  const units: SpokenUnit[] = [];
  tokens.forEach((t, token) => t.spoken.forEach((word) => units.push({ word, token })));
  return { tokens, units };
}

export function countWords(text: string): number {
  return buildPassage(text).tokens.length;
}

// ---- Aligning ----------------------------------------------------------------

export function initialAlign(passage: Passage): AlignState {
  return {
    pointer: 0,
    status: passage.units.map(() => 'pending' as WordStatus),
    heard: passage.units.map(() => null),
  };
}

export function isFinished(passage: Passage, state: AlignState): boolean {
  return state.pointer >= passage.units.length;
}

/** Feeds one heard word to the alignment and returns the new state. */
export function alignStep(passage: Passage, state: AlignState, word: string): AlignState {
  const units = passage.units;
  const p = state.pointer;
  if (!word || p >= units.length) return state;
  const status = [...state.status];
  const heard = [...state.heard];

  // 1. The word we expect (or the tries so far glued together: "ke" + "di").
  const attempt = heard[p];
  if (wordsMatch(word, units[p].word) || (attempt !== null && wordsMatch(attempt.replace(/ /g, '') + word, units[p].word))) {
    status[p] = 'correct';
    heard[p] = null;
    return { pointer: p + 1, status, heard };
  }

  // 2. A hesitation sound, or re-reading the last few words: not an error.
  if (FILLERS.has(word)) return state;
  for (let k = 1; k <= LOOKBEHIND && p - k >= 0; k++) {
    if (status[p - k] === 'correct' && wordsMatch(word, units[p - k].word)) return state;
  }

  // 3. A word a little further on: the ones in between were skipped (or misread).
  for (let j = 1; j <= LOOKAHEAD && p + j < units.length; j++) {
    const target = units[p + j].word;
    if (j > SHORT_LOOKAHEAD && [...target].length <= 3) continue;
    if (!wordsMatch(word, target)) continue;
    for (let i = p; i < p + j; i++) status[i] = heard[i] !== null ? 'wrong' : 'skipped';
    status[p + j] = 'correct';
    return { pointer: p + j + 1, status, heard };
  }

  // 4. An attempt at the current word. A second miss in a row means the child
  //    moved on: the current word is wrong and this one is a try at the next.
  if (attempt === null) {
    status[p] = 'wrong';
    heard[p] = word;
    return { pointer: p, status, heard };
  }
  status[p] = 'wrong';
  const moved: AlignState = { pointer: p + 1, status, heard };
  if (p + 1 >= units.length) return moved;
  return alignStep(passage, moved, word);
}

export function alignWords(passage: Passage, words: string[], from: AlignState = initialAlign(passage)): AlignState {
  return words.reduce((s, w) => alignStep(passage, s, w), from);
}

/** Convenience: aligns the full recognized transcript from scratch. */
export function alignTranscript(passage: Passage, transcript: string): AlignState {
  return alignWords(passage, heardWords(transcript));
}

// ---- Per token view ----------------------------------------------------------

/**
 * Status per on-screen word. A multi-word token ("23") is doğru when all its
 * parts are, atlandı when all were skipped, yanlış otherwise.
 */
export function tokenStatuses(passage: Passage, state: AlignState): WordStatus[] {
  const parts: WordStatus[][] = passage.tokens.map(() => []);
  passage.units.forEach((u, i) => parts[u.token].push(state.status[i]));
  return parts.map((s) => {
    if (s.every((x) => x === 'pending')) return 'pending';
    if (s.every((x) => x === 'correct')) return 'correct';
    if (s.every((x) => x === 'skipped')) return 'skipped';
    if (s.some((x) => x === 'pending') && !s.some((x) => x === 'wrong' || x === 'skipped')) return 'pending';
    return 'wrong';
  });
}

/** The on-screen word the child is on now (-1 when done). */
export function currentToken(passage: Passage, state: AlignState): number {
  return state.pointer < passage.units.length ? passage.units[state.pointer].token : -1;
}

/** What was heard for each misread on-screen word. */
export function tokenHeard(passage: Passage, state: AlignState): (string | null)[] {
  const out: (string | null)[] = passage.tokens.map(() => null);
  passage.units.forEach((u, i) => {
    const h = state.heard[i];
    if (h) out[u.token] = out[u.token] ? `${out[u.token]} ${h}` : h;
  });
  return out;
}

// ---- Results -----------------------------------------------------------------

/** The word as a child would look it up: no punctuation, original case kept. */
export function cleanWord(display: string): string {
  return display.replace(/[^\p{L}\p{N}’'\s-]+/gu, '').replace(/^[’'-]+|[’'-]+$/g, '').trim();
}

/** Final numbers from per-token statuses. A word still pending is "unread". */
export function readingStats(passage: Passage, statuses: WordStatus[], durationMs: number): ReadingStats {
  const count = (s: WordStatus) => statuses.filter((x) => x === s).length;
  const correct = count('correct');
  const wrong = count('wrong');
  const skipped = count('skipped');
  const attempted = correct + wrong + skipped;
  const minutes = durationMs / 60000;
  const seen = new Set<string>();
  const struggled: string[] = [];
  statuses.forEach((s, i) => {
    if (s !== 'wrong' && s !== 'skipped') return;
    const w = cleanWord(passage.tokens[i].display);
    const key = passage.tokens[i].norm;
    if (!w || seen.has(key)) return;
    seen.add(key);
    struggled.push(w);
  });
  return {
    totalWords: passage.tokens.length,
    correct,
    wrong,
    skipped,
    unread: count('pending'),
    accuracy: attempted ? Math.round((correct / attempted) * 100) : 0,
    wcpm: minutes > 0 ? Math.max(0, Math.min(400, Math.round(correct / minutes))) : 0,
    durationMs: Math.max(0, Math.round(durationMs)),
    struggled,
  };
}

/**
 * Dinleyici modu: the listener tapped the words the child stumbled on and,
 * if the child stopped early, the last word read (`lastRead`, inclusive).
 */
export function listenerStatuses(totalTokens: number, marked: Iterable<number>, lastRead = totalTokens - 1): WordStatus[] {
  const bad = new Set(marked);
  return Array.from({ length: totalTokens }, (_, i) => (i > lastRead ? 'pending' : bad.has(i) ? 'wrong' : 'correct'));
}

// ---- Feedback ----------------------------------------------------------------

export interface Band {
  min: number;
  max: number;
}

/** Stars from accuracy and speed; reading anything earns at least one. */
export function readingStars(accuracy: number, wcpm: number, band: Band, correct: number): 0 | 1 | 2 | 3 {
  if (correct === 0) return 0;
  if (accuracy >= 95 && wcpm >= band.min) return 3;
  if ((accuracy >= 90 && wcpm >= band.min * 0.7) || accuracy >= 95) return 2;
  return 1;
}

export type SpeedLevel = 'growing' | 'onTarget' | 'above';

export function speedLevel(wcpm: number, band: Band): SpeedLevel {
  if (wcpm < band.min) return 'growing';
  if (wcpm > band.max) return 'above';
  return 'onTarget';
}

/** Kind, never shaming words about the result. */
export function readingFeedback(stats: Pick<ReadingStats, 'wcpm' | 'accuracy'>, band: Band): string {
  const level = speedLevel(stats.wcpm, band);
  if (stats.accuracy < 85 && level !== 'growing') {
    return 'Çok hızlı okudun! Biraz yavaşlayıp her kelimeye dikkat edersen daha da güzel olacak. 🐢✨';
  }
  switch (level) {
    case 'above':
      return 'Harika! Hedefin bile üstünde, çok akıcı okudun. 🚀';
    case 'onTarget':
      return 'Tam hedefteydin! Akıcı ve güzel okudun. 🎯';
    default:
      return stats.accuracy >= 90
        ? 'Kelimeleri çok dikkatli okudun! Her gün biraz okursan hızın da artacak. 🌱'
        : 'Güzel bir deneme! Takıldığın kelimeleri dinleyip bir daha okuyalım. 💪';
  }
}
