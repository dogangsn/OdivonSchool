import { shuffled } from './math-generator';
import { ROUND_SIZE, Rng, randInt, randPick } from './interactive-round';
import { accusative, dative, numberWords } from './turkish-numbers';

/** Saat Ustası: read an analog clock or set its hands. */
export interface ClockPreset {
  id: string;
  grades: number[];
  title: string;
  description: string;
  emoji: string;
  /** Minutes the target times are multiples of (30 = tam/buçuk, 15 = çeyrek...). */
  step: 30 | 15 | 5 | 1;
  outcomeCode?: string;
}

export const CLOCK_PRESETS: ClockPreset[] = [
  { id: 'saat-tam-yarim', grades: [1], title: 'Tam ve Yarım Saatler', description: 'Saat üç, saat üç buçuk', emoji: '🕒', step: 30, outcomeCode: 'MAT.1.3' },
  { id: 'saat-ceyrek', grades: [2], title: 'Çeyrek Saatler', description: 'Çeyrek geçiyor, çeyrek var', emoji: '🕞', step: 15, outcomeCode: 'MAT.2.3' },
  { id: 'saat-5-dakika', grades: [2, 3], title: '5’er Dakika', description: 'Yelkovanı 5’er dakika say', emoji: '⏰', step: 5 },
  { id: 'saat-dakika', grades: [3, 4], title: 'Dakika Ustası', description: 'Saati dakikası dakikasına oku', emoji: '⌚', step: 1, outcomeCode: 'MAT.3.3' },
];

export function clockPresetById(id: string): ClockPreset | undefined {
  return CLOCK_PRESETS.find((p) => p.id === id);
}

/** A 12-hour clock time: hour 1-12, minute 0-59. */
export interface ClockTime {
  hour: number;
  minute: number;
}

export type ClockMode = 'read' | 'set';

export interface ClockProblem {
  mode: ClockMode;
  target: ClockTime;
  /** "03:30" */
  digital: string;
  /** "saat üç buçuk" */
  phrase: string;
  /** read mode: four digital times, one of them `digital`. */
  options: string[];
  explanation: string;
}

/** 3:30 → "03:30". */
export function formatDigital(t: ClockTime): string {
  return `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;
}

export function parseDigital(s: string): ClockTime | null {
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour < 1 || hour > 12 || minute > 59) return null;
  return { hour, minute };
}

export function sameTime(a: ClockTime, b: ClockTime): boolean {
  return a.hour === b.hour && a.minute === b.minute;
}

function nextHour(h: number): number {
  return (h % 12) + 1;
}

/**
 * The time as a child says it:
 * 3:00 "saat üç", 3:30 "saat üç buçuk", 3:15 "saat üçü çeyrek geçiyor",
 * 3:10 "saat üçü on geçiyor", 3:45 "saat dörde çeyrek var", 3:50 "saat dörde on var".
 */
export function timePhrase(t: ClockTime): string {
  const { hour, minute } = t;
  if (minute === 0) return `saat ${numberWords(hour)}`;
  if (minute === 30) return `saat ${numberWords(hour)} buçuk`;
  if (minute < 30) {
    const m = minute === 15 ? 'çeyrek' : numberWords(minute);
    return `saat ${accusative(hour)} ${m} geçiyor`;
  }
  const left = 60 - minute;
  const m = left === 15 ? 'çeyrek' : numberWords(left);
  return `saat ${dative(nextHour(hour))} ${m} var`;
}

/** "6’yı", "3’ü", "12’yi": a digit with its accusative ending. */
export function digitAccusative(n: number): string {
  return `${n}’${accusative(n).slice(numberWords(n).length)}`;
}

// ---- Hand geometry (degrees clockwise from 12) ------------------------------

export function minuteHandAngle(t: ClockTime): number {
  return t.minute * 6;
}

export function hourHandAngle(t: ClockTime): number {
  return ((t.hour % 12) + t.minute / 60) * 30;
}

/** Angle of a point relative to the clock centre (dx right, dy down). */
export function angleFromVector(dx: number, dy: number): number {
  const deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return (deg + 360) % 360;
}

/** Minute the minute hand points at, snapped to `snap` minutes. */
export function minuteFromAngle(deg: number, snap: number): number {
  const m = Math.round(deg / 6 / snap) * snap;
  return ((m % 60) + 60) % 60;
}

/** Hour the hour hand belongs to, given where the minute hand already is. */
export function hourFromAngle(deg: number, minute: number): number {
  const h = Math.round(deg / 30 - minute / 60);
  const mod = ((h % 12) + 12) % 12;
  return mod === 0 ? 12 : mod;
}

/** Adds minutes, wrapping on a 12-hour dial. */
export function addMinutes(t: ClockTime, delta: number): ClockTime {
  const total = ((((t.hour % 12) * 60 + t.minute + delta) % 720) + 720) % 720;
  const hour = Math.floor(total / 60);
  return { hour: hour === 0 ? 12 : hour, minute: total % 60 };
}

/**
 * Moving the minute hand to `minute`; like a real clock, passing 12 forwards
 * moves the hour on (and backwards moves it back).
 */
export function moveMinuteHand(t: ClockTime, minute: number): ClockTime {
  let delta = minute - t.minute;
  if (delta > 30) delta -= 60;
  if (delta < -30) delta += 60;
  return addMinutes(t, delta);
}

/** How far the dragged minute hand snaps: to the numbers, or to every minute for the dakika level. */
export function handSnap(preset: ClockPreset): number {
  return Math.min(preset.step, 5);
}

// ---- Problems -----------------------------------------------------------------

function randomMinute(rng: Rng, step: ClockPreset['step']): number {
  switch (step) {
    case 30:
      return randPick(rng, [0, 30]);
    case 15:
      return randPick(rng, [0, 15, 15, 30, 45, 45]);
    case 5:
      return rng() < 0.75 ? randPick(rng, [5, 10, 20, 25, 35, 40, 50, 55]) : randPick(rng, [0, 15, 30, 45]);
    default: {
      if (rng() < 0.3) return randInt(rng, 0, 11) * 5;
      let m = randInt(rng, 1, 59);
      if (m % 5 === 0) m = (m + randInt(rng, 1, 4)) % 60;
      return m;
    }
  }
}

function minuteExplanation(minute: number): string {
  if (minute === 0) return 'Yelkovan (uzun kol) 12’yi gösteriyor: tam saat.';
  if (minute % 5 === 0) {
    const n = minute / 5;
    return `Yelkovan (uzun kol) ${digitAccusative(n)} gösteriyor: ${n} × 5 = ${minute} dakika.`;
  }
  const n = Math.floor(minute / 5);
  if (n === 0) return `Yelkovan (uzun kol) 12’yi ${minute} küçük çizgi geçmiş: ${minute} dakika.`;
  return `Yelkovan (uzun kol) ${n} ile ${n + 1} arasında: ${n * 5} dakika ve ${minute - n * 5} küçük çizgi daha, ${minute} dakika.`;
}

function hourExplanation(t: ClockTime): string {
  if (t.minute === 0) return `Akrep (kısa kol) ${digitAccusative(t.hour)} gösteriyor.`;
  return `Akrep (kısa kol) ${t.hour} ile ${nextHour(t.hour)} arasında; saat henüz ${nextHour(t.hour)} olmadı.`;
}

export function clockExplanation(t: ClockTime): string {
  const parts = [minuteExplanation(t.minute), hourExplanation(t)];
  if (t.minute > 30) parts.push(`Yelkovan 6’yı geçince sonraki saate kaç dakika kaldığını söyleriz: ${60 - t.minute} dakika.`);
  const phrase = timePhrase(t);
  parts.push(`Yani ${formatDigital(t)}, “${phrase.charAt(0).toLocaleUpperCase('tr')}${phrase.slice(1)}”.`);
  return parts.join(' ');
}

/** Wrong choices made from typical mix-ups: swapped hands, the next hour, 15 ↔ 45. */
export function clockDistractors(t: ClockTime, step: ClockPreset['step'], rng: Rng): ClockTime[] {
  const candidates: ClockTime[] = [];
  if (t.minute % 5 === 0) {
    const swappedHour = t.minute === 0 ? 12 : t.minute / 5;
    candidates.push({ hour: swappedHour, minute: (t.hour % 12) * 5 });
  }
  candidates.push({ hour: nextHour(t.hour), minute: t.minute });
  candidates.push({ hour: t.hour === 1 ? 12 : t.hour - 1, minute: t.minute });
  if (t.minute !== 0 && t.minute !== 30) candidates.push({ hour: t.hour, minute: 60 - t.minute });
  candidates.push({ hour: t.hour, minute: (t.minute + 30) % 60 });
  const s = Math.max(step, 5);
  candidates.push(addMinutes(t, s), addMinutes(t, -s));

  const out: ClockTime[] = [];
  const seen = new Set([formatDigital(t)]);
  for (const c of shuffled(rng, candidates)) {
    const key = formatDigital(c);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(c);
    }
    if (out.length === 3) break;
  }
  while (out.length < 3) {
    const c = { hour: randInt(rng, 1, 12), minute: randomMinute(rng, step) };
    const key = formatDigital(c);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(c);
    }
  }
  return out;
}

export function generateClockProblem(preset: ClockPreset, mode: ClockMode, rng: Rng = Math.random): ClockProblem {
  let target: ClockTime;
  do {
    target = { hour: randInt(rng, 1, 12), minute: randomMinute(rng, preset.step) };
    // The set-mode clock starts at 12:00, so that target would be free.
  } while (mode === 'set' && target.hour === 12 && target.minute === 0);
  const digital = formatDigital(target);
  const options =
    mode === 'read' ? shuffled(rng, [digital, ...clockDistractors(target, preset.step, rng).map(formatDigital)]) : [];
  return { mode, target, digital, phrase: timePhrase(target), options, explanation: clockExplanation(target) };
}

/** Ten problems, half "Saat kaç?" and half "Saati kur", mixed, no time twice. */
export function generateClockRound(preset: ClockPreset, rng: Rng = Math.random, size = ROUND_SIZE): ClockProblem[] {
  const modes = shuffled(rng, Array.from({ length: size }, (_, i): ClockMode => (i % 2 === 0 ? 'read' : 'set')));
  const seen = new Set<string>();
  const out: ClockProblem[] = [];
  for (const mode of modes) {
    let p = generateClockProblem(preset, mode, rng);
    for (let guard = 0; seen.has(p.digital) && guard < 50; guard++) p = generateClockProblem(preset, mode, rng);
    seen.add(p.digital);
    out.push(p);
  }
  return out;
}

/** Start position of the hands in "Saati kur". */
export const CLOCK_START: ClockTime = { hour: 12, minute: 0 };
