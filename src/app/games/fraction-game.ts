import { shuffled } from './math-generator';
import { ROUND_SIZE, Rng, randInt, randPick } from './interactive-round';
import { locative, numberWords, possessiveAccusative } from './turkish-numbers';

/** Kesir Pizzası: shade a fraction of a shape, or compare two fractions. */
export interface FractionPreset {
  id: string;
  grades: number[];
  title: string;
  description: string;
  emoji: string;
  /** Denominators the shading questions use. */
  denominators: number[];
  /** Share of comparison questions. */
  compareShare: number;
  /** 2. sınıf: "yarısını / çeyreğini" in words, no fraction notation. */
  words: boolean;
  /** Whether the shapes of a comparison are shaded from the start or only after answering (with a hint button). */
  compareVisual: 'always' | 'after';
  outcomeCode?: string;
}

export const FRACTION_PRESETS: FractionPreset[] = [
  { id: 'kesir-yarim-ceyrek', grades: [2], title: 'Yarım ve Çeyrek', description: 'Bütün, yarım, çeyrek', emoji: '🍕', denominators: [2, 4], compareShare: 0.2, words: true, compareVisual: 'always', outcomeCode: 'MAT.2.1.6' },
  { id: 'kesir-birim', grades: [3], title: 'Kesirleri Boya', description: 'Kesirleri boya, birim kesirleri karşılaştır', emoji: '🍕', denominators: [2, 3, 4, 5, 6, 8], compareShare: 0.3, words: false, compareVisual: 'always', outcomeCode: 'MAT.3.1.6' },
  { id: 'kesir-karsilastir', grades: [4], title: 'Kesir Karşılaştırma', description: 'Hangisi daha büyük? Boya ve karşılaştır', emoji: '⚖️', denominators: [3, 4, 5, 6, 8, 10, 12], compareShare: 0.5, words: false, compareVisual: 'after', outcomeCode: 'MAT.4.1.7' },
];

export function fractionPresetById(id: string): FractionPreset | undefined {
  return FRACTION_PRESETS.find((p) => p.id === id);
}

export interface Fraction {
  n: number;
  d: number;
}

export type FractionShape = 'circle' | 'rect';

export interface ShadeProblem {
  kind: 'shade';
  target: Fraction;
  /** Slices the shape is cut into (a multiple of target.d). */
  parts: number;
  shape: FractionShape;
  prompt: string;
  /** How many slices must be shaded. */
  answer: number;
  /** The target as written in results: "3/4" or "yarım (1/2)". */
  answerLabel: string;
  explanation: string;
}

export interface CompareProblem {
  kind: 'compare';
  left: Fraction;
  right: Fraction;
  shape: FractionShape;
  prompt: string;
  /** "1/3", "1/5" or EQUAL. */
  options: string[];
  answer: string;
  explanation: string;
}

export type FractionProblem = ShadeProblem | CompareProblem;

export const EQUAL = 'Eşit';

export function fractionLabel(f: Fraction): string {
  return `${f.n}/${f.d}`;
}

/** 3/4 → "dörtte üç". */
export function fractionWords(f: Fraction): string {
  return `${locative(f.d)} ${numberWords(f.n)}`;
}

/** 3/4 → "dörtte üçünü" ("Pizzanın dörtte üçünü boya"). */
export function fractionWordsAccusative(f: Fraction): string {
  return `${locative(f.d)} ${possessiveAccusative(f.n)}`;
}

/** Positive: a > b, 0 equal, negative: a < b. */
export function compareFractions(a: Fraction, b: Fraction): number {
  return a.n * b.d - b.n * a.d;
}

export function isShadeCorrect(p: ShadeProblem, shaded: number): boolean {
  return shaded === p.answer;
}

function shapeName(shape: FractionShape): string {
  return shape === 'circle' ? 'Pizzanın' : 'Çikolatanın';
}

/** 2. sınıf wording: yarım, çeyrek, iki/üç çeyrek, tamamı. */
function wordsTarget(f: Fraction): { acc: string; label: string } {
  if (f.n === f.d) return { acc: 'tamamını', label: `bütün (${fractionLabel(f)})` };
  if (f.d === 2) return { acc: 'yarısını', label: 'yarım (1/2)' };
  if (f.n === 1) return { acc: 'çeyreğini', label: 'çeyrek (1/4)' };
  return { acc: `${numberWords(f.n)} çeyreğini`, label: `${numberWords(f.n)} çeyrek (${fractionLabel(f)})` };
}

function pickShape(rng: Rng, d: number): FractionShape {
  // Pizzas are cut into easy-to-see slices; odd big denominators read better as a bar.
  if ([2, 3, 4, 6, 8].includes(d)) return rng() < 0.7 ? 'circle' : 'rect';
  return rng() < 0.4 ? 'circle' : 'rect';
}

function shadeProblem(preset: FractionPreset, rng: Rng): ShadeProblem {
  const d = randPick(rng, preset.denominators);
  const n = preset.words ? randPick(rng, d === 2 ? [1, 1, 2] : [1, 1, 2, 3, 4]) : randInt(rng, 1, d - 1);
  const target = { n, d };
  // Sometimes cut into twice as many slices: "yarısını boya" on 4 slices means 2 of them.
  const k = d <= 4 && rng() < 0.3 ? 2 : 1;
  const parts = d * k;
  const shape = pickShape(rng, parts);
  const answer = n * k;
  const name = shapeName(shape);

  if (preset.words) {
    const w = wordsTarget(target);
    let explanation = `${parts} eş parçanın ${answer} tanesini boyamalıydın.`;
    if (n === d) explanation = `Tamamı demek bütün demek: ${parts} parçanın hepsini boya.`;
    else if (d === 2) explanation = `Yarım, bütünü 2 eş parçaya bölüp birini almaktır. ${parts} parçanın yarısı ${answer} parça.`;
    else explanation = `Çeyrek, bütünü 4 eş parçaya bölüp birini almaktır. ${numberWords(n)} çeyrek = ${n * k} parça.`;
    return { kind: 'shade', target, parts, shape, prompt: `${name} ${w.acc} boya.`, answer, answerLabel: w.label, explanation };
  }

  let explanation = `${fractionLabel(target)}: payda ${d}, bütün ${d} eş parçaya bölünür; pay ${n}, bunlardan ${n} tanesi boyanır.`;
  if (k > 1) explanation += ` Burada her parça ikiye bölünmüş: ${fractionLabel(target)} = ${answer}/${parts}, yani ${answer} dilim.`;
  return {
    kind: 'shade',
    target,
    parts,
    shape,
    prompt: `${name} ${fractionWordsAccusative(target)} (${fractionLabel(target)}) boya.`,
    answer,
    answerLabel: fractionLabel(target),
    explanation,
  };
}

/** Pairs a 2. sınıf child can compare: yarım vs çeyrek, bir çeyrek vs üç çeyrek. */
function wordsPair(rng: Rng): [Fraction, Fraction] {
  return randPick(rng, [
    [{ n: 1, d: 2 }, { n: 1, d: 4 }],
    [{ n: 1, d: 4 }, { n: 3, d: 4 }],
    [{ n: 1, d: 2 }, { n: 2, d: 4 }],
    [{ n: 3, d: 4 }, { n: 1, d: 2 }],
  ] as [Fraction, Fraction][]);
}

function comparePair(preset: FractionPreset, rng: Rng): [Fraction, Fraction, string] {
  const ds = preset.denominators.filter((d) => d >= 2);
  const roll = rng();
  if (preset.words) {
    return [...wordsPair(rng), 'words'];
  }
  if (roll < 0.4) {
    // Birim kesirler: 1/3 vs 1/5
    const [a, b] = shuffled(rng, ds).slice(0, 2);
    return [{ n: 1, d: a }, { n: 1, d: b }, 'unit'];
  }
  if (roll < 0.75 || preset.compareVisual === 'always') {
    // Paydaları eşit: 3/5 vs 2/5
    const d = randPick(rng, ds.filter((x) => x >= 3));
    const [a, b] = shuffled(rng, Array.from({ length: d - 1 }, (_, i) => i + 1)).slice(0, 2);
    return [{ n: a, d }, { n: b, d }, 'sameDen'];
  }
  if (roll < 0.88) {
    // Denk kesirler: 2/4 vs 1/2, 2/6 vs 1/3
    const base = randPick(rng, [2, 3, 4]);
    const pair: [Fraction, Fraction] = shuffled(rng, [
      { n: 1, d: base },
      { n: 2, d: base * 2 },
    ]) as [Fraction, Fraction];
    return [...pair, 'equal'];
  }
  // Payları eşit: 2/3 vs 2/5
  const [a, b] = shuffled(rng, ds.filter((d) => d >= 3)).slice(0, 2);
  return [{ n: 2, d: a }, { n: 2, d: b }, 'sameNum'];
}

function compareExplanation(left: Fraction, right: Fraction, kind: string, words: boolean): string {
  const c = compareFractions(left, right);
  const [big, small] = c > 0 ? [left, right] : [right, left];
  const label = (f: Fraction) => (words ? wordsTarget(f).label : fractionLabel(f));
  if (c === 0) {
    return `${label(left)} ile ${label(right)} aynı miktarı gösterir: resimlerde boyalı kısımlar eşit büyüklükte.`;
  }
  switch (kind) {
    case 'unit':
      return `Bütün ne kadar çok parçaya bölünürse her parça o kadar küçük olur. ${big.d} parçadan biri, ${small.d} parçadan birinden büyüktür: ${fractionLabel(big)} > ${fractionLabel(small)}.`;
    case 'sameDen':
      return `Paydalar aynı, yani parçalar eşit büyüklükte. Payı büyük olan daha çok parça demektir: ${fractionLabel(big)} > ${fractionLabel(small)}.`;
    case 'sameNum':
      return `Paylar aynı (ikişer parça). Parçası büyük olan, yani paydası küçük olan daha büyüktür: ${fractionLabel(big)} > ${fractionLabel(small)}.`;
    default:
      return `Resimlere bak: ${label(big)} için boyanan kısım, ${label(small)} için boyanan kısımdan daha büyük.`;
  }
}

function compareProblem(preset: FractionPreset, rng: Rng): CompareProblem {
  const [left, right, kind] = comparePair(preset, rng);
  const c = compareFractions(left, right);
  const label = (f: Fraction) => (preset.words ? wordsTarget(f).label : fractionLabel(f));
  const answer = c === 0 ? EQUAL : c > 0 ? label(left) : label(right);
  return {
    kind: 'compare',
    left,
    right,
    shape: rng() < 0.6 ? 'circle' : 'rect',
    prompt: 'Hangisi daha büyük?',
    options: [label(left), label(right), EQUAL],
    answer,
    explanation: compareExplanation(left, right, kind, preset.words),
  };
}

export function generateFractionProblem(preset: FractionPreset, rng: Rng = Math.random): FractionProblem {
  return rng() < preset.compareShare ? compareProblem(preset, rng) : shadeProblem(preset, rng);
}

function problemKey(p: FractionProblem): string {
  return p.kind === 'shade' ? `s${p.target.n}/${p.target.d}:${p.parts}` : `c${fractionLabel(p.left)}-${fractionLabel(p.right)}`;
}

/** Ten problems, no exact repeat when the preset has enough variety. */
export function generateFractionRound(preset: FractionPreset, rng: Rng = Math.random, size = ROUND_SIZE): FractionProblem[] {
  const out: FractionProblem[] = [];
  const seen = new Set<string>();
  for (let guard = 0; out.length < size && guard < 400; guard++) {
    const p = generateFractionProblem(preset, rng);
    const key = problemKey(p);
    if (seen.has(key) && guard < 300) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

/** Text for the mistakes list: "Pizzanın dörtte üçünü (3/4) boya." / "Hangisi daha büyük? 1/3 mü, 1/5 mi?" */
export function mistakePrompt(p: FractionProblem): string {
  if (p.kind === 'shade') return p.prompt;
  return `Hangisi daha büyük: ${p.options[0]} ya da ${p.options[1]}?`;
}

// ---- Shapes ---------------------------------------------------------------------

export interface ShapeGeometry {
  viewBox: string;
  /** One SVG path per equal slice, in reading order. */
  slices: string[];
  /** Outline drawn on top (crust / wrapper). */
  outline: string;
}

const R = 90;

function point(deg: number, r: number): string {
  const rad = (deg * Math.PI) / 180;
  return `${(Math.sin(rad) * r).toFixed(2)},${(-Math.cos(rad) * r).toFixed(2)}`;
}

/**
 * Equal slices of a circle (pizza, cut from 12 o'clock clockwise) or of a bar
 * (chocolate; two rows when there are 8 or more even parts so pieces stay tappable).
 */
export function shapeSlices(shape: FractionShape, parts: number): ShapeGeometry {
  if (shape === 'circle') {
    const slices = Array.from({ length: parts }, (_, i) => {
      const a0 = (i * 360) / parts;
      const a1 = ((i + 1) * 360) / parts;
      const large = a1 - a0 > 180 ? 1 : 0;
      return `M0,0 L${point(a0, R)} A${R},${R} 0 ${large} 1 ${point(a1, R)} Z`;
    });
    return { viewBox: '-100 -100 200 200', slices, outline: `M0,${-R} A${R},${R} 0 1 1 0,${R} A${R},${R} 0 1 1 0,${-R} Z` };
  }
  const rows = parts >= 8 && parts % 2 === 0 ? 2 : 1;
  const cols = parts / rows;
  const W = 240;
  const H = rows === 2 ? 150 : 110;
  const x0 = 10;
  const y0 = 10;
  const cw = (W - 2 * x0) / cols;
  const ch = (H - 2 * y0) / rows;
  const slices: string[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = x0 + c * cw;
      const y = y0 + r * ch;
      slices.push(`M${x.toFixed(2)},${y.toFixed(2)} h${cw.toFixed(2)} v${ch.toFixed(2)} h${(-cw).toFixed(2)} Z`);
    }
  }
  return { viewBox: `0 0 ${W} ${H}`, slices, outline: `M${x0},${y0} h${W - 2 * x0} v${H - 2 * y0} h${-(W - 2 * x0)} Z` };
}
