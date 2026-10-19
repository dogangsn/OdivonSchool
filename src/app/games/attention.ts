/**
 * Dikkat oyunları: Dikkat Radarı (tap only on the target) and Dinle ve Uygula
 * (hear a sequence of colored shapes, tap them in order).
 */
export interface RadarPreset {
  id: string;
  title: string;
  description: string;
  emoji: string;
  grades: number[];
  target: string;
  targetName: string;
  /** Distractors; "similar" ones make the harder levels harder. */
  distractors: string[];
  intervalMs: number;
  stimuli: number;
  /** Share of stimuli that are the target. */
  targetRate: number;
}

export const RADAR_PRESETS: RadarPreset[] = [
  {
    id: 'elma',
    title: 'Elmayı Yakala',
    description: 'Yalnızca kırmızı elma görünce dokun',
    emoji: '🍎',
    grades: [1, 2],
    target: '🍎',
    targetName: 'kırmızı elma',
    distractors: ['🍌', '🍇', '🥕', '🍐', '🍊'],
    intervalMs: 1300,
    stimuli: 30,
    targetRate: 0.3,
  },
  {
    id: 'yildiz',
    title: 'Yıldız Avı',
    description: 'Sarı yıldızı yakala, diğer şekillere dokunma',
    emoji: '⭐',
    grades: [2, 3],
    target: '⭐',
    targetName: 'sarı yıldız',
    distractors: ['🌙', '☀️', '⚡', '🔶', '💛'],
    intervalMs: 1050,
    stimuli: 36,
    targetRate: 0.28,
  },
  {
    id: 'kedi',
    title: 'Benzer Hayvanlar',
    description: 'Kediyi bul; kaplan ve aslan seni şaşırtmasın',
    emoji: '🐱',
    grades: [3, 4],
    target: '🐱',
    targetName: 'kedi',
    distractors: ['🐯', '🦁', '🐶', '🐭', '🐹', '🦊'],
    intervalMs: 900,
    stimuli: 40,
    targetRate: 0.25,
  },
  {
    id: 'harf',
    title: 'b mi d mi?',
    description: 'Yalnızca "b" harfine dokun, d, p ve q’ya dikkat',
    emoji: '🔤',
    grades: [1, 2, 3, 4],
    target: 'b',
    targetName: '"b" harfi',
    distractors: ['d', 'p', 'q', 'h'],
    intervalMs: 1100,
    stimuli: 36,
    targetRate: 0.3,
  },
];

export function radarPresetById(id: string): RadarPreset | null {
  return RADAR_PRESETS.find((p) => p.id === id) ?? null;
}

/**
 * Builds the stimulus stream: exactly round(stimuli·rate) targets, never two
 * targets in a row more than twice, distractors not repeating back to back.
 */
export function radarStream(p: RadarPreset, rand: () => number = Math.random): string[] {
  const targets = Math.max(1, Math.round(p.stimuli * p.targetRate));
  const flags = Array<boolean>(p.stimuli).fill(false);
  let placed = 0;
  let guard = 0;
  while (placed < targets && guard++ < 10_000) {
    const i = 1 + Math.floor(rand() * (p.stimuli - 1)); // never first: give a moment to settle
    if (flags[i] || (flags[i - 1] && flags[i - 2])) continue;
    flags[i] = true;
    placed++;
  }
  const out: string[] = [];
  for (let i = 0; i < p.stimuli; i++) {
    if (flags[i]) {
      out.push(p.target);
      continue;
    }
    let d = p.distractors[Math.floor(rand() * p.distractors.length)];
    if (d === out[i - 1] && p.distractors.length > 1) {
      d = p.distractors[(p.distractors.indexOf(d) + 1) % p.distractors.length];
    }
    out.push(d);
  }
  return out;
}

export interface RadarTally {
  hits: number;
  misses: number;
  falseAlarms: number;
  correctRejections: number;
}

/** `tapped[i]` = the player tapped while stimulus i was showing. */
export function tallyRadar(stream: readonly string[], tapped: readonly boolean[], target: string): RadarTally {
  const t: RadarTally = { hits: 0, misses: 0, falseAlarms: 0, correctRejections: 0 };
  stream.forEach((s, i) => {
    const isTarget = s === target;
    const tap = !!tapped[i];
    if (isTarget && tap) t.hits++;
    else if (isTarget) t.misses++;
    else if (tap) t.falseAlarms++;
    else t.correctRejections++;
  });
  return t;
}

/** Fast hits are worth more; every false alarm costs. */
export function radarScore(t: RadarTally, avgReactionMs: number): number {
  const speedBonus = t.hits > 0 ? Math.max(0, Math.round((900 - avgReactionMs) / 10)) : 0;
  return Math.max(0, t.hits * 100 + t.correctRejections * 10 - t.falseAlarms * 60 + speedBonus * t.hits);
}

// --- Dinle ve Uygula ---

export interface ShapeChip {
  id: string;
  color: string;
  colorName: string;
  shape: 'daire' | 'kare' | 'üçgen' | 'yıldız';
}

const COLORS = [
  { color: '#ef4444', name: 'kırmızı' },
  { color: '#3b82f6', name: 'mavi' },
  { color: '#eab308', name: 'sarı' },
  { color: '#22c55e', name: 'yeşil' },
];
const SHAPES: ShapeChip['shape'][] = ['daire', 'kare', 'üçgen', 'yıldız'];

export interface ListenPreset {
  id: string;
  title: string;
  description: string;
  emoji: string;
  grades: number[];
  /** Shapes on the board. */
  chips: number;
  /** Command length for round 1; grows by one every two rounds. */
  startLength: number;
  rounds: number;
}

export const LISTEN_PRESETS: ListenPreset[] = [
  { id: 'baslangic', title: 'Dinle ve Uygula 1', description: '2 adımlı komutlar, 6 şekil', emoji: '👂', grades: [1, 2], chips: 6, startLength: 2, rounds: 8 },
  { id: 'orta', title: 'Dinle ve Uygula 2', description: '3 adımdan başlayan komutlar, 8 şekil', emoji: '🎧', grades: [2, 3, 4], chips: 8, startLength: 3, rounds: 8 },
  { id: 'usta', title: 'Dinle ve Uygula 3', description: '4 adımdan başlayan komutlar, 12 şekil', emoji: '🧠', grades: [3, 4], chips: 12, startLength: 4, rounds: 8 },
];

export function listenPresetById(id: string): ListenPreset | null {
  return LISTEN_PRESETS.find((p) => p.id === id) ?? null;
}

/** A board of distinct color+shape chips. */
export function listenBoard(count: number, rand: () => number = Math.random): ShapeChip[] {
  const all: ShapeChip[] = [];
  for (const c of COLORS) for (const s of SHAPES) all.push({ id: `${c.name}-${s}`, color: c.color, colorName: c.name, shape: s });
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.slice(0, Math.max(2, Math.min(all.length, count)));
}

export function commandLength(p: ListenPreset, round: number): number {
  return p.startLength + Math.floor(round / 2);
}

/** Random sequence of chip ids, no chip twice in a row. */
export function listenSequence(board: readonly ShapeChip[], length: number, rand: () => number = Math.random): string[] {
  const seq: string[] = [];
  while (seq.length < length) {
    const c = board[Math.floor(rand() * board.length)].id;
    if (c !== seq[seq.length - 1]) seq.push(c);
  }
  return seq;
}

export function chipLabel(id: string): string {
  return id.replace('-', ' ');
}

/** "Önce mavi kareye, sonra sarı yıldıza, en son kırmızı daireye dokun." */
export function commandText(seq: readonly string[]): string {
  const parts = seq.map((id) => dativeOf(chipLabel(id)));
  if (parts.length === 1) return `${capitalize(parts[0])} dokun.`;
  const middle = parts.slice(1, -1).map((p) => `sonra ${p}`);
  return ['Önce ' + parts[0], ...middle, 'en son ' + parts[parts.length - 1] + ' dokun.'].join(', ');
}

function capitalize(s: string) {
  return s.charAt(0).toLocaleUpperCase('tr') + s.slice(1);
}

/** Turkish dative for our four shape names. */
export function dativeOf(label: string): string {
  if (label.endsWith('daire')) return label + 'ye';
  if (label.endsWith('kare')) return label + 'ye';
  if (label.endsWith('üçgen')) return label + 'e';
  if (label.endsWith('yıldız')) return label + 'a';
  return label + 'e';
}
