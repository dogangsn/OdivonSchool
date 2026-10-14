import {
  EQUAL,
  FRACTION_PRESETS,
  FractionProblem,
  compareFractions,
  fractionLabel,
  fractionPresetById,
  fractionWords,
  fractionWordsAccusative,
  generateFractionProblem,
  generateFractionRound,
  isShadeCorrect,
  mistakePrompt,
  shapeSlices,
} from './fraction-game';

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe('fraction-game', () => {
  it('reads fractions in Turkish', () => {
    expect(fractionWords({ n: 3, d: 4 })).toBe('dörtte üç');
    expect(fractionWords({ n: 1, d: 2 })).toBe('ikide bir');
    expect(fractionWords({ n: 5, d: 6 })).toBe('altıda beş');
    expect(fractionWordsAccusative({ n: 3, d: 4 })).toBe('dörtte üçünü');
    expect(fractionWordsAccusative({ n: 2, d: 5 })).toBe('beşte ikisini');
    expect(fractionWordsAccusative({ n: 4, d: 10 })).toBe('onda dördünü');
    expect(fractionWordsAccusative({ n: 6, d: 8 })).toBe('sekizde altısını');
    expect(fractionWordsAccusative({ n: 7, d: 12 })).toBe('on ikide yedisini');
  });

  it('compares fractions', () => {
    expect(compareFractions({ n: 1, d: 3 }, { n: 1, d: 5 })).toBeGreaterThan(0);
    expect(compareFractions({ n: 2, d: 5 }, { n: 3, d: 5 })).toBeLessThan(0);
    expect(compareFractions({ n: 2, d: 4 }, { n: 1, d: 2 })).toBe(0);
  });

  it('every preset generates consistent problems', () => {
    const rng = seeded(8);
    for (const preset of FRACTION_PRESETS) {
      for (let i = 0; i < 400; i++) {
        const p = generateFractionProblem(preset, rng);
        expect(p.explanation.length).toBeGreaterThan(10);
        if (p.kind === 'shade') {
          expect(p.parts % p.target.d).toBe(0);
          expect(p.answer).toBe((p.target.n * p.parts) / p.target.d);
          expect(p.answer).toBeGreaterThan(0);
          expect(p.answer).toBeLessThanOrEqual(p.parts);
          expect(isShadeCorrect(p, p.answer)).toBeTrue();
          expect(isShadeCorrect(p, p.answer - 1)).toBeFalse();
          expect(p.prompt).toMatch(/^(Pizzanın|Çikolatanın) .+ boya\.$/);
          if (!preset.words) {
            expect(p.target.n).toBeLessThan(p.target.d);
            expect(p.prompt).toContain(`(${fractionLabel(p.target)})`);
            expect(preset.denominators).toContain(p.target.d);
          }
        } else {
          expect(p.options.length).toBe(3);
          expect(p.options).toContain(p.answer);
          expect(p.options[2]).toBe(EQUAL);
          const c = compareFractions(p.left, p.right);
          expect(p.answer).toBe(c === 0 ? EQUAL : c > 0 ? p.options[0] : p.options[1]);
          expect(p.left.n).toBeLessThan(p.left.d + 1);
          expect(p.right.n).toBeLessThan(p.right.d + 1);
          expect(fractionLabel(p.left) === fractionLabel(p.right)).toBeFalse();
        }
      }
    }
  });

  it('2. sınıf uses words: yarısını, çeyreğini, tamamını', () => {
    const preset = fractionPresetById('kesir-yarim-ceyrek')!;
    const rng = seeded(4);
    const prompts = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const p = generateFractionProblem(preset, rng);
      if (p.kind === 'shade') prompts.add(p.prompt.replace(/^\S+ /, ''));
    }
    expect(prompts).toContain('yarısını boya.');
    expect(prompts).toContain('çeyreğini boya.');
    expect(prompts).toContain('üç çeyreğini boya.');
    expect(prompts).toContain('tamamını boya.');
    [...prompts].forEach((t) => expect(t).not.toMatch(/\d/));
  });

  it('shading half of a 4-slice pizza needs 2 slices', () => {
    const rng = seeded(12);
    let seen = false;
    for (let i = 0; i < 300 && !seen; i++) {
      const p = generateFractionProblem(fractionPresetById('kesir-yarim-ceyrek')!, rng);
      if (p.kind === 'shade' && p.target.d === 2 && p.target.n === 1 && p.parts === 4) {
        expect(p.answer).toBe(2);
        seen = true;
      }
    }
    expect(seen).toBeTrue();
  });

  it('4. sınıf compares several kinds, including equal fractions', () => {
    const rng = seeded(30);
    let equal = 0;
    let compares = 0;
    for (let i = 0; i < 600; i++) {
      const p = generateFractionProblem(fractionPresetById('kesir-karsilastir')!, rng);
      if (p.kind === 'compare') {
        compares++;
        if (p.answer === EQUAL) equal++;
      }
    }
    expect(compares).toBeGreaterThan(200);
    expect(equal).toBeGreaterThan(5);
  });

  it('a round has 10 problems and a readable mistake prompt', () => {
    const rng = seeded(1);
    for (const preset of FRACTION_PRESETS) {
      const round: FractionProblem[] = generateFractionRound(preset, rng);
      expect(round.length).toBe(10);
      round.forEach((p) => expect(mistakePrompt(p).length).toBeGreaterThan(5));
    }
  });
});

describe('fraction shapes', () => {
  it('cuts pizzas and bars into the right number of slices', () => {
    for (const n of [2, 3, 4, 5, 6, 8, 10, 12]) {
      expect(shapeSlices('circle', n).slices.length).toBe(n);
      expect(shapeSlices('rect', n).slices.length).toBe(n);
    }
    expect(shapeSlices('rect', 8).viewBox).toBe('0 0 240 150');
    expect(shapeSlices('rect', 5).viewBox).toBe('0 0 240 110');
    expect(shapeSlices('circle', 2).slices[0]).toContain('A90,90 0 0 1');
    shapeSlices('circle', 6).slices.forEach((d) => expect(d).not.toContain('NaN'));
  });
});
