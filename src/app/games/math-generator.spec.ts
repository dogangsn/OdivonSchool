import { SPEED_PRESETS, generateMathPairs, generateProblem, numericOptions } from './math-generator';
import { MATCH_SETS, pairsForGame } from './match-sets';

/** Deterministic PRNG so failures are reproducible. */
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function evaluate(text: string): number | null {
  const m = text.match(/^(\d+) ([+−×÷]) (\d+)$/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[3]);
  switch (m[2]) {
    case '+':
      return a + b;
    case '−':
      return a - b;
    case '×':
      return a * b;
    default:
      return a / b;
  }
}

describe('math-generator', () => {
  it('every preset produces correct, unique, non-negative options', () => {
    const rng = seeded(42);
    for (const preset of SPEED_PRESETS) {
      for (const d of [1, 2, 3] as const) {
        for (let i = 0; i < 200; i++) {
          const p = generateProblem(preset, d, rng);
          expect(p.options).toContain(p.answer);
          expect(new Set(p.options).size).toBe(p.options.length);
          expect(p.explanation.length).toBeGreaterThan(0);

          const value = evaluate(p.text);
          if (value !== null) {
            expect(String(value)).toBe(p.answer);
            expect(Number.isInteger(value)).toBeTrue();
            expect(value).toBeGreaterThanOrEqual(0);
            for (const o of p.options) expect(Number(o)).toBeGreaterThanOrEqual(0);
          }
        }
      }
    }
  });

  it('keeps 1. sınıf sums within 20', () => {
    const preset = SPEED_PRESETS.find((p) => p.id === 'g1-toplama')!;
    const rng = seeded(7);
    for (let i = 0; i < 300; i++) {
      expect(Number(generateProblem(preset, 3, rng).answer)).toBeLessThanOrEqual(20);
    }
  });

  it('comparison answers are <, = or >', () => {
    const preset = SPEED_PRESETS.find((p) => p.id === 'g1-karsilastir')!;
    const rng = seeded(3);
    for (let i = 0; i < 100; i++) {
      const p = generateProblem(preset, 2, rng);
      const [a, b] = p.text.split(' ☐ ').map(Number);
      expect(p.answer).toBe(a > b ? '>' : a < b ? '<' : '=');
    }
  });

  it('numericOptions always returns four distinct choices', () => {
    const rng = seeded(9);
    const opts = numericOptions(rng, 0, [0, -1, -2]);
    expect(opts.length).toBe(4);
    expect(new Set(opts).size).toBe(4);
    expect(opts).toContain('0');
  });

  it('math pairs have unique answers', () => {
    const rng = seeded(11);
    for (const preset of SPEED_PRESETS.filter((p) => p.skills[0] === 'carpma')) {
      const pairs = generateMathPairs(preset, 6, rng);
      expect(pairs.length).toBe(6);
      expect(new Set(pairs.map((p) => p[1])).size).toBe(6);
    }
  });

  it('every match set can deal a full game with unique cards', () => {
    const rng = seeded(5);
    for (const set of MATCH_SETS) {
      const pairs = pairsForGame(set, rng);
      expect(pairs.length).toBeGreaterThanOrEqual(5);
      const texts = pairs.flat();
      expect(new Set(texts).size).toBe(texts.length);
    }
  });
});
