/**
 * Kelime Avı: places words in a letter grid (across, down and, when allowed,
 * diagonal and backwards) and fills the rest with random Turkish letters.
 */
export interface WordSearchOptions {
  size: number;
  diagonal: boolean;
  backwards: boolean;
}

export interface PlacedWord {
  word: string;
  row: number;
  col: number;
  dr: number;
  dc: number;
}

export interface WordSearch {
  grid: string[][];
  placed: PlacedWord[];
  /** Words that did not fit. */
  skipped: string[];
}

const LETTERS = 'ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ';

/** Upper-cases in Turkish and keeps letters only ("çiçek!" -> "ÇİÇEK"). */
export function normalizeWord(w: string): string {
  return w
    .toLocaleUpperCase('tr')
    .split('')
    .filter((ch) => LETTERS.includes(ch))
    .join('');
}

export function parseWords(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/[\n,;]+/)) {
    const w = normalizeWord(raw);
    if (w.length < 2 || seen.has(w)) continue;
    seen.add(w);
    out.push(w);
    if (out.length >= 20) break;
  }
  return out;
}

export function buildWordSearch(
  words: readonly string[],
  opts: WordSearchOptions,
  rand: () => number = Math.random
): WordSearch {
  const size = Math.max(6, Math.min(20, Math.floor(opts.size)));
  const grid: string[][] = Array.from({ length: size }, () => Array<string>(size).fill(''));
  const dirs: [number, number][] = [
    [0, 1],
    [1, 0],
  ];
  if (opts.diagonal) dirs.push([1, 1], [-1, 1]);
  if (opts.backwards) {
    for (const [dr, dc] of [...dirs]) dirs.push([-dr, -dc]);
  }

  const placed: PlacedWord[] = [];
  const skipped: string[] = [];
  // Longest first: they are the hardest to fit.
  const order = [...words].map(normalizeWord).filter((w) => w.length >= 2).sort((a, b) => b.length - a.length);

  for (const word of order) {
    if (word.length > size) {
      skipped.push(word);
      continue;
    }
    let done = false;
    for (let attempt = 0; attempt < 300 && !done; attempt++) {
      const [dr, dc] = dirs[Math.floor(rand() * dirs.length)];
      const row = Math.floor(rand() * size);
      const col = Math.floor(rand() * size);
      const endR = row + dr * (word.length - 1);
      const endC = col + dc * (word.length - 1);
      if (endR < 0 || endR >= size || endC < 0 || endC >= size) continue;
      let fits = true;
      for (let i = 0; i < word.length; i++) {
        const cell = grid[row + dr * i][col + dc * i];
        if (cell && cell !== word[i]) {
          fits = false;
          break;
        }
      }
      if (!fits) continue;
      for (let i = 0; i < word.length; i++) grid[row + dr * i][col + dc * i] = word[i];
      placed.push({ word, row, col, dr, dc });
      done = true;
    }
    if (!done) skipped.push(word);
  }

  for (const line of grid) {
    for (let c = 0; c < size; c++) {
      if (!line[c]) line[c] = LETTERS[Math.floor(rand() * LETTERS.length)];
    }
  }
  return { grid, placed, skipped };
}

/** Cells covered by placed words, as "row-col" keys (for the answer key). */
export function answerCells(placed: readonly PlacedWord[]): Set<string> {
  const cells = new Set<string>();
  for (const p of placed) {
    for (let i = 0; i < p.word.length; i++) cells.add(`${p.row + p.dr * i}-${p.col + p.dc * i}`);
  }
  return cells;
}
