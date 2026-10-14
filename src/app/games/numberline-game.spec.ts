import {
  NUMBERLINE_PRESETS,
  formatLineValue,
  generateNumberLineProblem,
  generateNumberLineRound,
  isPlacementCorrect,
  lineTicks,
  markerStart,
  numberLinePresetById,
  ratioToValue,
  snapValue,
  valueToRatio,
} from './numberline-game';

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function evaluate(text: string): number {
  const frac = (s: string) => {
    const [n, d] = s.split('/').map(Number);
    return d ? n / d : n;
  };
  const m = text.match(/^(\S+) ([+−]) (\S+)$/);
  if (!m) return frac(text);
  return m[2] === '+' ? frac(m[1]) + frac(m[3]) : frac(m[1]) - frac(m[3]);
}

const p = (id: string) => numberLinePresetById(id)!;

describe('numberline-game', () => {
  it('has the expected presets', () => {
    expect(NUMBERLINE_PRESETS.map((x) => x.id)).toEqual([
      'dogru-0-10',
      'dogru-0-20',
      'dogru-0-100',
      'dogru-0-1000',
      'dogru-kesir',
      'dogru-kesir-islem',
    ]);
    expect(numberLinePresetById('yok')).toBeUndefined();
  });

  it('snaps and clamps values', () => {
    expect(snapValue(p('dogru-0-10'), 3.4)).toBe(3);
    expect(snapValue(p('dogru-0-10'), -2)).toBe(0);
    expect(snapValue(p('dogru-0-10'), 12)).toBe(10);
    expect(snapValue(p('dogru-0-1000'), 347)).toBe(350);
    expect(snapValue(p('dogru-kesir'), 0.6)).toBe(0.5);
    expect(snapValue(p('dogru-kesir'), 0.63)).toBe(0.75);
  });

  it('converts between ratio and value', () => {
    expect(valueToRatio(p('dogru-0-100'), 25)).toBe(0.25);
    expect(ratioToValue(p('dogru-0-100'), 0.374)).toBe(37);
    expect(ratioToValue(p('dogru-kesir'), 0.74)).toBe(0.75);
  });

  it('uses a tolerance that grows with the scale', () => {
    expect(isPlacementCorrect(p('dogru-0-10'), 7, 7)).toBeTrue();
    expect(isPlacementCorrect(p('dogru-0-10'), 7, 8)).toBeFalse();
    expect(isPlacementCorrect(p('dogru-0-100'), 37, 39)).toBeTrue();
    expect(isPlacementCorrect(p('dogru-0-100'), 37, 40)).toBeFalse();
    expect(isPlacementCorrect(p('dogru-0-1000'), 450, 470)).toBeTrue();
    expect(isPlacementCorrect(p('dogru-0-1000'), 450, 480)).toBeFalse();
    expect(isPlacementCorrect(p('dogru-kesir'), 0.75, 0.75)).toBeTrue();
    expect(isPlacementCorrect(p('dogru-kesir'), 0.75, 0.5)).toBeFalse();
  });

  it('formats fractions in lowest terms', () => {
    const f = p('dogru-kesir');
    expect(formatLineValue(f, 0)).toBe('0');
    expect(formatLineValue(f, 0.25)).toBe('1/4');
    expect(formatLineValue(f, 0.5)).toBe('1/2');
    expect(formatLineValue(f, 0.75)).toBe('3/4');
    expect(formatLineValue(f, 1)).toBe('1');
    expect(formatLineValue(p('dogru-0-100'), 42)).toBe('42');
  });

  it('builds ticks with labels', () => {
    const t10 = lineTicks(p('dogru-0-10'));
    expect(t10.length).toBe(11);
    expect(t10.filter((t) => t.label).map((t) => t.label)).toEqual(['0', '5', '10']);
    const t1000 = lineTicks(p('dogru-0-1000'));
    expect(t1000.length).toBe(21);
    expect(t1000.filter((t) => t.label).length).toBe(11);
    const tf = lineTicks(p('dogru-kesir'));
    expect(tf.map((t) => t.value)).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(tf.filter((t) => t.label).map((t) => t.label)).toEqual(['0', '1']);
  });

  it('every preset generates reachable, correct targets', () => {
    const rng = seeded(11);
    for (const preset of NUMBERLINE_PRESETS) {
      for (let i = 0; i < 400; i++) {
        const q = generateNumberLineProblem(preset, rng);
        expect(q.target).toBeGreaterThan(preset.min);
        expect(q.target).toBeLessThanOrEqual(preset.max);
        expect(snapValue(preset, q.target)).toBe(q.target); // reachable with the marker
        expect(q.target).not.toBe(markerStart(preset));
        expect(evaluate(q.prompt)).toBeCloseTo(q.target, 9);
        expect(q.explanation.length).toBeGreaterThan(10);
        if (q.kind === 'operation' && !preset.denominators) {
          const nums = q.prompt.split(/ [+−] /).map(Number);
          nums.forEach((n) => {
            expect(n).toBeGreaterThan(0);
            expect(n).toBeLessThanOrEqual(preset.max);
          });
        }
      }
    }
  });

  it('fraction answers are written as fractions', () => {
    const rng = seeded(5);
    for (let i = 0; i < 100; i++) {
      const q = generateNumberLineProblem(p('dogru-kesir-islem'), rng);
      expect(q.answerLabel).toMatch(/^\d\/\d$/);
      expect(evaluate(q.answerLabel)).toBeCloseTo(q.target, 9);
    }
  });

  it('explains placement in tens', () => {
    const rng = seeded(2);
    for (let i = 0; i < 100; i++) {
      const q = generateNumberLineProblem(p('dogru-0-100'), rng);
      if (q.kind === 'number' && q.target % 10 !== 0) {
        const lower = Math.floor(q.target / 10) * 10;
        expect(q.explanation).toContain(`${lower} ile ${lower + 10} arasında`);
      }
    }
  });

  it('a round has 10 problems without repeated prompts on whole-number lines', () => {
    const rng = seeded(21);
    for (const preset of NUMBERLINE_PRESETS) {
      for (let r = 0; r < 20; r++) {
        const round = generateNumberLineRound(preset, rng);
        expect(round.length).toBe(10);
        if (!preset.denominators) expect(new Set(round.map((q) => q.prompt)).size).toBe(10);
      }
    }
  });
});
