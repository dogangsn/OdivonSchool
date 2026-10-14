import { GameProblem } from './game-models';

export type MathSkill =
  | 'toplama'
  | 'cikarma'
  | 'carpma'
  | 'bolme'
  | 'karsilastirma'
  | 'ritmik';

/** One Hız Turu card on the games page. */
export interface SpeedPreset {
  id: string;
  grade: number;
  title: string;
  description: string;
  emoji: string;
  skills: MathSkill[];
  /** MEB outcome the preset practises, shown on the card. */
  outcomeCode?: string;
}

export const SPEED_PRESETS: SpeedPreset[] = [
  { id: 'g1-toplama', grade: 1, title: 'Toplama Yarışı', description: "20'ye kadar toplama", emoji: '➕', skills: ['toplama'], outcomeCode: 'MAT.1.2' },
  { id: 'g1-cikarma', grade: 1, title: 'Çıkarma Yarışı', description: "20'ye kadar çıkarma", emoji: '➖', skills: ['cikarma'], outcomeCode: 'MAT.1.2' },
  { id: 'g1-karsilastir', grade: 1, title: 'Büyük mü Küçük mü?', description: 'Sayıları karşılaştır', emoji: '⚖️', skills: ['karsilastirma'], outcomeCode: 'MAT.1.1.4' },
  { id: 'g2-toplama-cikarma', grade: 2, title: 'İşlem Rallisi', description: "100'e kadar toplama ve çıkarma", emoji: '🏎️', skills: ['toplama', 'cikarma'] },
  { id: 'g2-ritmik', grade: 2, title: 'Ritmik Sayma', description: "2'şer, 5'er, 10'ar say", emoji: '🎵', skills: ['ritmik'] },
  { id: 'g2-carpma', grade: 2, title: 'Çarpmaya Giriş', description: '2, 3, 4 ve 5 ile çarpma', emoji: '✖️', skills: ['carpma'] },
  { id: 'g3-carpim-tablosu', grade: 3, title: 'Çarpım Tablosu', description: '1’den 10’a çarpım tablosu', emoji: '🚀', skills: ['carpma'] },
  { id: 'g3-bolme', grade: 3, title: 'Bölme Avı', description: 'Çarpım tablosuyla bölme', emoji: '🍕', skills: ['bolme'] },
  { id: 'g3-karisik', grade: 3, title: 'Karışık İşlemler', description: "1000'e kadar toplama ve çıkarma", emoji: '🎯', skills: ['toplama', 'cikarma'] },
  { id: 'g4-carpma', grade: 4, title: 'Büyük Çarpmalar', description: 'İki basamaklı × bir basamaklı', emoji: '💪', skills: ['carpma'] },
  { id: 'g4-bolme', grade: 4, title: 'Bölme Ustası', description: 'Üç basamaklı ÷ bir basamaklı', emoji: '🧮', skills: ['bolme'] },
  { id: 'g4-dort-islem', grade: 4, title: 'Dört İşlem Karnavalı', description: 'Hepsi bir arada', emoji: '🎪', skills: ['toplama', 'cikarma', 'carpma', 'bolme'] },
];

export function presetById(id: string): SpeedPreset | undefined {
  return SPEED_PRESETS.find((p) => p.id === id);
}

/** Difficulty 1-3 inside a preset; the game raises it on a hot streak. */
export type Difficulty = 1 | 2 | 3;

type Rng = () => number;

function int(rng: Rng, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function pick<T>(rng: Rng, list: readonly T[]): T {
  return list[Math.floor(rng() * list.length)];
}

export function shuffled<T>(rng: Rng, list: readonly T[]): T[] {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Four numeric choices: the answer plus "typical mistake" distractors
 * (off by one, off by ten, neighbouring table rows), never negative.
 */
export function numericOptions(rng: Rng, answer: number, candidates: number[]): string[] {
  const seen = new Set<number>([answer]);
  const picks: number[] = [];
  for (const c of shuffled(rng, candidates)) {
    if (c >= 0 && Number.isInteger(c) && !seen.has(c)) {
      seen.add(c);
      picks.push(c);
    }
    if (picks.length === 3) break;
  }
  let step = 1;
  while (picks.length < 3) {
    for (const c of [answer + step, answer - step]) {
      if (picks.length < 3 && c >= 0 && !seen.has(c)) {
        seen.add(c);
        picks.push(c);
      }
    }
    step++;
  }
  return shuffled(rng, [answer, ...picks]).map(String);
}

interface Ranges {
  addMax: number; // largest sum / minuend
  mulA: [number, number];
  mulB: [number, number];
  cmpMax: number;
}

function rangesFor(preset: SpeedPreset, d: Difficulty): Ranges {
  switch (preset.grade) {
    case 1:
      return { addMax: [10, 15, 20][d - 1], mulA: [1, 2], mulB: [1, 5], cmpMax: [10, 20, 20][d - 1] };
    case 2:
      return {
        addMax: [30, 60, 100][d - 1],
        mulA: [2, [3, 4, 5][d - 1]],
        mulB: [1, [5, 8, 10][d - 1]],
        cmpMax: 100,
      };
    case 3:
      return {
        addMax: [100, 500, 1000][d - 1],
        mulA: [[1, 2, 5][d - 1], [5, 9, 10][d - 1]] as [number, number],
        mulB: [1, 10],
        cmpMax: 1000,
      };
    default:
      return {
        addMax: [1000, 5000, 10000][d - 1],
        mulA: [[11, 20, 40][d - 1], [30, 60, 99][d - 1]] as [number, number],
        mulB: [2, 9],
        cmpMax: 10000,
      };
  }
}

function addition(rng: Rng, r: Ranges): GameProblem {
  const sum = int(rng, 2, r.addMax);
  const a = int(rng, 1, sum - 1);
  const b = sum - a;
  let explanation = `${a} + ${b} = ${sum}.`;
  if (a < 10 && b < 10 && sum > 10) {
    const fill = 10 - a;
    explanation = `Önce ${a} sayısını 10'a tamamla (${a} + ${fill} = 10), sonra kalan ${b - fill} sayısını ekle: 10 + ${b - fill} = ${sum}.`;
  } else if (sum >= 20) {
    explanation = `Önce birlikleri, sonra onlukları topla: ${a} + ${b} = ${sum}.`;
  }
  return {
    text: `${a} + ${b}`,
    answer: String(sum),
    options: numericOptions(rng, sum, [sum + 1, sum - 1, sum + 10, sum - 10, a - b, sum + 2]),
    explanation,
  };
}

function subtraction(rng: Rng, r: Ranges): GameProblem {
  const a = int(rng, 2, r.addMax);
  const b = int(rng, 1, a - 1);
  const diff = a - b;
  return {
    text: `${a} − ${b}`,
    answer: String(diff),
    options: numericOptions(rng, diff, [diff + 1, diff - 1, diff + 10, diff - 10, a + b, diff + 2]),
    explanation: `Sağlamasını yap: ${diff} + ${b} = ${a}. Yani ${a} − ${b} = ${diff}.`,
  };
}

function multiplicationExplanation(a: number, b: number): string {
  const product = a * b;
  if (b <= 5) {
    return `${a} × ${b} demek, ${b} tane ${a} sayısını toplamak demek: ${Array(b).fill(a).join(' + ')} = ${product}.`;
  }
  if (a <= 10) {
    const five = a * 5;
    return `İpucu: ${a} × 5 = ${five}. Üstüne ${b - 5} tane daha ${a} ekle: ${five} + ${a * (b - 5)} = ${product}.`;
  }
  const tens = Math.floor(a / 10) * 10;
  const ones = a - tens;
  return `Parçala: ${tens} × ${b} = ${tens * b}, ${ones} × ${b} = ${ones * b}. Topla: ${product}.`;
}

function multiplication(rng: Rng, r: Ranges): GameProblem {
  let a = int(rng, r.mulA[0], r.mulA[1]);
  let b = int(rng, r.mulB[0], r.mulB[1]);
  if (a <= 10 && rng() < 0.5) [a, b] = [b, a];
  const product = a * b;
  return {
    text: `${a} × ${b}`,
    answer: String(product),
    options: numericOptions(rng, product, [
      a * (b + 1),
      a * (b - 1),
      (a + 1) * b,
      (a - 1) * b,
      a + b,
      product + 10,
      product - 10,
    ]),
    explanation: multiplicationExplanation(a, b),
    visual: product <= 40 && a <= 10 && b <= 10 ? { rows: b, cols: a } : undefined,
  };
}

function division(rng: Rng, r: Ranges): GameProblem {
  const divisor = Math.max(2, int(rng, r.mulB[0], r.mulB[1]));
  const quotient = int(rng, Math.max(1, r.mulA[0]), Math.max(2, r.mulA[1]));
  const dividend = divisor * quotient;
  return {
    text: `${dividend} ÷ ${divisor}`,
    answer: String(quotient),
    options: numericOptions(rng, quotient, [quotient + 1, quotient - 1, quotient + 10, divisor, quotient + 2]),
    explanation: `Bölme, çarpmanın tersidir: ${divisor} × ${quotient} = ${dividend}. O hâlde ${dividend} ÷ ${divisor} = ${quotient}.`,
  };
}

function comparison(rng: Rng, r: Ranges): GameProblem {
  const a = int(rng, 0, r.cmpMax);
  const b = rng() < 0.15 ? a : int(rng, 0, r.cmpMax);
  const answer = a > b ? '>' : a < b ? '<' : '=';
  let explanation = `${a} ile ${b} eşittir.`;
  if (a !== b) {
    const [big, small] = a > b ? [a, b] : [b, a];
    explanation = `${big} sayısı ${small} sayısından büyüktür. Timsahın ağzı her zaman büyük sayıya açılır: ${a} ${answer} ${b}.`;
  }
  return { text: `${a} ☐ ${b}`, answer, options: ['<', '=', '>'], explanation };
}

function skipCounting(rng: Rng, d: Difficulty): GameProblem {
  const step = pick(rng, d === 1 ? [2, 10] : d === 2 ? [2, 5, 10] : [3, 4, 5, 10]);
  const start = step * int(rng, 0, 6);
  const seq = [0, 1, 2, 3].map((i) => start + i * step);
  const answer = start + 4 * step;
  return {
    text: `${seq.join(', ')}, ?`,
    answer: String(answer),
    options: numericOptions(rng, answer, [answer + 1, answer - 1, answer + step, answer - step + 1]),
    explanation: `Her sayı bir öncekinden ${step} fazla: ${seq[3]} + ${step} = ${answer}.`,
  };
}

/** Builds one Hız Turu problem for the preset at the given difficulty. */
export function generateProblem(preset: SpeedPreset, d: Difficulty, rng: Rng = Math.random): GameProblem {
  const r = rangesFor(preset, d);
  switch (pick(rng, preset.skills)) {
    case 'toplama':
      return addition(rng, r);
    case 'cikarma':
      return subtraction(rng, r);
    case 'carpma':
      return multiplication(rng, r);
    case 'bolme':
      return division(rng, r);
    case 'karsilastirma':
      return comparison(rng, r);
    case 'ritmik':
      return skipCounting(rng, d);
  }
}

/** Pairs for the Eşleştir game built from a preset: "6 × 7" ↔ "42", answers unique. */
export function generateMathPairs(preset: SpeedPreset, count: number, rng: Rng = Math.random): [string, string][] {
  const pairs: [string, string][] = [];
  const answers = new Set<string>();
  for (let guard = 0; pairs.length < count && guard < 500; guard++) {
    const p = generateProblem(preset, 2, rng);
    if (answers.has(p.answer) || p.text.includes('?') || p.text.includes('☐')) continue;
    answers.add(p.answer);
    pairs.push([p.text, p.answer]);
  }
  return pairs;
}
