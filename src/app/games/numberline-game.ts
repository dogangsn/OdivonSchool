import { shuffled } from './math-generator';
import { ROUND_SIZE, Rng, randInt, randPick } from './interactive-round';

/** Sayı Doğrusu: drag the marker to where a number (or a result) belongs. */
export interface NumberLinePreset {
  id: string;
  grades: number[];
  title: string;
  description: string;
  emoji: string;
  min: number;
  max: number;
  /** The marker moves in steps of this size. */
  snap: number;
  /** A placement within ± tolerance counts as right. */
  tolerance: number;
  /** Labelled ticks. */
  labelEvery: number;
  /** Small unlabelled ticks. */
  tickEvery: number;
  /** Fraction lines (0-1) only: denominators to ask about. */
  denominators?: number[];
  /** Share of problems that are an operation ("25 + 12") instead of a number. */
  opsShare: number;
  /** First operand of an operation is a multiple of this ("40 + 25"). */
  opUnit: number;
  outcomeCode?: string;
}

export const NUMBERLINE_PRESETS: NumberLinePreset[] = [
  { id: 'dogru-0-10', grades: [1], title: '0’dan 10’a', description: 'Sayıyı doğruda bul', emoji: '📏', min: 0, max: 10, snap: 1, tolerance: 0, labelEvery: 5, tickEvery: 1, opsShare: 0.3, opUnit: 1 },
  { id: 'dogru-0-20', grades: [1, 2], title: '0’dan 20’ye', description: 'Sayılar ve işlemler', emoji: '🐸', min: 0, max: 20, snap: 1, tolerance: 0, labelEvery: 5, tickEvery: 1, opsShare: 0.4, opUnit: 1 },
  { id: 'dogru-0-100', grades: [2, 3], title: '0’dan 100’e', description: 'Onluklar arasında tahmin et', emoji: '🎯', min: 0, max: 100, snap: 1, tolerance: 2, labelEvery: 10, tickEvery: 5, opsShare: 0.4, opUnit: 10 },
  { id: 'dogru-0-1000', grades: [3, 4], title: '0’dan 1000’e', description: 'Yüzlükler arasında tahmin et', emoji: '🚀', min: 0, max: 1000, snap: 10, tolerance: 20, labelEvery: 100, tickEvery: 50, opsShare: 0.4, opUnit: 100 },
  { id: 'dogru-kesir', grades: [3, 4], title: 'Kesirler Doğrusu', description: 'Yarımlar ve çeyrekler, 0 ile 1 arası', emoji: '🍰', min: 0, max: 1, snap: 0.25, tolerance: 0, labelEvery: 1, tickEvery: 0.25, denominators: [2, 4], opsShare: 0, opUnit: 1 },
  { id: 'dogru-kesir-islem', grades: [4], title: 'Kesirlerle İşlem', description: 'Çeyreklerle toplama ve çıkarma', emoji: '🧁', min: 0, max: 1, snap: 0.25, tolerance: 0, labelEvery: 1, tickEvery: 0.25, denominators: [2, 4], opsShare: 0.6, opUnit: 1 },
];

export function numberLinePresetById(id: string): NumberLinePreset | undefined {
  return NUMBERLINE_PRESETS.find((p) => p.id === id);
}

export type NumberLineKind = 'number' | 'operation' | 'fraction';

export interface NumberLineProblem {
  kind: NumberLineKind;
  /** What the child places: "37", "25 + 12", "3/4". */
  prompt: string;
  target: number;
  /** The target as written in the answer: "37", "3/4". */
  answerLabel: string;
  explanation: string;
}

const EPS = 1e-9;

function clean(v: number): number {
  return Math.round(v * 1e6) / 1e6;
}

/** Clamps to the line and rounds to the marker step. */
export function snapValue(preset: NumberLinePreset, v: number): number {
  const clamped = Math.min(preset.max, Math.max(preset.min, v));
  return clean(Math.round((clamped - preset.min) / preset.snap) * preset.snap + preset.min);
}

export function isPlacementCorrect(preset: NumberLinePreset, target: number, value: number): boolean {
  return Math.abs(value - target) <= preset.tolerance + EPS;
}

/** 0-1 position of a value along the line. */
export function valueToRatio(preset: NumberLinePreset, v: number): number {
  return (v - preset.min) / (preset.max - preset.min);
}

export function ratioToValue(preset: NumberLinePreset, r: number): number {
  return snapValue(preset, preset.min + r * (preset.max - preset.min));
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** A value on the line as written: 37 → "37", 0.75 → "3/4", 0.5 → "1/2". */
export function formatLineValue(preset: NumberLinePreset, v: number): string {
  if (!preset.denominators) return String(clean(v));
  if (Math.abs(v - Math.round(v)) < EPS) return String(Math.round(v));
  const d = Math.round(1 / preset.snap);
  const n = Math.round(v * d);
  const g = gcd(n, d);
  return `${n / g}/${d / g}`;
}

export interface Tick {
  value: number;
  label: string | null;
}

/** Every tick on the line, labelled ones with their text. */
export function lineTicks(preset: NumberLinePreset): Tick[] {
  const ticks: Tick[] = [];
  const count = Math.round((preset.max - preset.min) / preset.tickEvery);
  for (let i = 0; i <= count; i++) {
    const value = clean(preset.min + i * preset.tickEvery);
    const labelled = Math.abs(value / preset.labelEvery - Math.round(value / preset.labelEvery)) < EPS;
    ticks.push({ value, label: labelled ? formatLineValue(preset, value) : null });
  }
  return ticks;
}

function placeExplanation(preset: NumberLinePreset, t: number): string {
  const L = preset.labelEvery;
  const lower = Math.floor(t / L + EPS) * L;
  if (Math.abs(t - lower) < EPS) return `${t} yazılı çizgilerden biri: doğrudan onu bul.`;
  const upper = lower + L;
  if (preset.tickEvery === preset.snap) {
    return `${t} = ${lower} + ${t - lower}. Önce ${lower} çizgisini bul, sonra ${t - lower} çizgi sağa say.`;
  }
  const mid = lower + L / 2;
  const where = t < mid ? 'ortadaki çizgiden önce' : t > mid ? 'ortadaki çizgiden sonra' : 'tam ortadaki çizgide';
  return `${t}, ${lower} ile ${upper} arasında. Ortadaki çizgi ${mid}; ${t} ${where}.`;
}

function randomTarget(preset: NumberLinePreset, rng: Rng): number {
  const steps = Math.round((preset.max - preset.min) / preset.snap);
  for (;;) {
    const t = clean(preset.min + randInt(rng, 1, steps) * preset.snap);
    // Mostly ask for numbers between the labels, where the thinking happens.
    if (t % preset.labelEvery === 0 && rng() < 0.7) continue;
    return t;
  }
}

function numberProblem(preset: NumberLinePreset, rng: Rng): NumberLineProblem {
  const t = randomTarget(preset, rng);
  return { kind: 'number', prompt: String(t), target: t, answerLabel: String(t), explanation: placeExplanation(preset, t) };
}

function operationProblem(preset: NumberLinePreset, rng: Rng): NumberLineProblem {
  const u = preset.opUnit;
  for (;;) {
    const t = randomTarget(preset, rng);
    let text: string;
    if (rng() < 0.55) {
      // a + b = t, a a multiple of opUnit
      const kMax = Math.floor((t - preset.snap) / u);
      if (kMax < 1) continue;
      const a = u * randInt(rng, 1, kMax);
      text = `${a} + ${clean(t - a)}`;
    } else {
      // a − b = t
      const kMax = Math.floor((preset.max - t) / u);
      if (kMax < 1) continue;
      const b = u * randInt(rng, 1, kMax);
      text = `${clean(t + b)} − ${b}`;
    }
    return {
      kind: 'operation',
      prompt: text,
      target: t,
      answerLabel: String(t),
      explanation: `${text} = ${t}. ${placeExplanation(preset, t)}`,
    };
  }
}

function fractionExplanation(preset: NumberLinePreset, n: number, d: number): string {
  const parts = Math.round(1 / preset.tickEvery);
  let text = `${n}/${d}: 0 ile 1 arasını ${d} eşit parçaya böl ve soldan ${n} parça say.`;
  if (d !== parts) {
    const k = parts / d;
    text += ` Bu doğruda her küçük aralık 1/${parts}; ${n}/${d} = ${n * k}/${parts}, yani soldan ${n * k} aralık.`;
  }
  if (n === d) text += ` ${n}/${d} bir bütündür, yani 1.`;
  else if (2 * n === d) text += ` ${n}/${d} yarım demektir: tam orta.`;
  return text;
}

function fractionProblem(preset: NumberLinePreset, rng: Rng): NumberLineProblem {
  const d = randPick(rng, preset.denominators ?? [2]);
  // Mostly proper fractions; a whole (2/2, 4/4) now and then.
  const n = rng() < 0.1 ? d : randInt(rng, 1, d - 1);
  return { kind: 'fraction', prompt: `${n}/${d}`, target: clean(n / d), answerLabel: `${n}/${d}`, explanation: fractionExplanation(preset, n, d) };
}

/** Paydaları eşit kesirlerle işlem: "1/4 + 2/4", "3/4 − 1/4". */
function fractionOperation(preset: NumberLinePreset, rng: Rng): NumberLineProblem {
  const d = Math.max(...(preset.denominators ?? [4]));
  let a: number;
  let b: number;
  let n: number;
  let text: string;
  if (rng() < 0.55) {
    a = randInt(rng, 1, d - 1);
    b = randInt(rng, 1, d - a);
    n = a + b;
    text = `${a}/${d} + ${b}/${d}`;
  } else {
    a = randInt(rng, 2, d);
    b = randInt(rng, 1, a - 1);
    n = a - b;
    text = `${a}/${d} − ${b}/${d}`;
  }
  return {
    kind: 'operation',
    prompt: text,
    target: clean(n / d),
    answerLabel: `${n}/${d}`,
    explanation: `Paydalar aynı, payları ${text.includes('+') ? 'topla' : 'çıkar'}: ${text} = ${n}/${d}. ${fractionExplanation(preset, n, d)}`,
  };
}

export function generateNumberLineProblem(preset: NumberLinePreset, rng: Rng = Math.random): NumberLineProblem {
  if (preset.denominators) return rng() < preset.opsShare ? fractionOperation(preset, rng) : fractionProblem(preset, rng);
  return rng() < preset.opsShare ? operationProblem(preset, rng) : numberProblem(preset, rng);
}

/** Ten problems with different prompts; the targets are spread out where possible. */
export function generateNumberLineRound(preset: NumberLinePreset, rng: Rng = Math.random, size = ROUND_SIZE): NumberLineProblem[] {
  const out: NumberLineProblem[] = [];
  const prompts = new Set<string>();
  for (let guard = 0; out.length < size && guard < 500; guard++) {
    const p = generateNumberLineProblem(preset, rng);
    if (prompts.has(p.prompt)) continue;
    // Fraction lines only have a handful of different points; allow repeats there after a few tries.
    if (out.length && out[out.length - 1].target === p.target && guard < 400) continue;
    prompts.add(p.prompt);
    out.push(p);
  }
  // Tiny lines (0-1 in quarters) can run out of distinct prompts.
  while (out.length < size) out.push(generateNumberLineProblem(preset, rng));
  return shuffled(rng, out);
}

/** Where the marker starts: at the left end, which is never a target. */
export function markerStart(preset: NumberLinePreset): number {
  return preset.min;
}
