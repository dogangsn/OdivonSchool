import { InteractiveRound, roundPoints } from './interactive-round';

describe('InteractiveRound', () => {
  it('gives a streak bonus up to +80', () => {
    expect([1, 2, 3, 4, 5, 6, 9].map(roundPoints)).toEqual([100, 120, 140, 160, 180, 180, 180]);
  });

  it('tracks score, streak, mistakes and builds the outcome', () => {
    const r = new InteractiveRound<number>();
    r.start([1, 2, 3, 4], 1000);
    expect(r.current()).toBe(1);
    expect(r.answer(true)).toBe(100);
    r.advance();
    expect(r.answer(true)).toBe(120);
    r.advance();
    expect(r.answer(false, { prompt: 'p', correctAnswer: 'a', given: 'b' })).toBe(0);
    expect(r.streak()).toBe(0);
    expect(r.advance()).toBeTrue();
    r.answer(true);
    expect(r.isLast()).toBeTrue();
    expect(r.advance()).toBeFalse();

    const o = r.outcome({ gameType: 'clock', gameKey: 'k', title: 'T', grade: 2 }, 6000);
    expect(o.score).toBe(320);
    expect(o.correct).toBe(3);
    expect(o.total).toBe(4);
    expect(o.durationMs).toBe(5000);
    expect(o.stars).toBe(2);
    expect(o.subject).toBe('Matematik');
    expect(o.mistakes).toEqual([{ prompt: 'p', correctAnswer: 'a', given: 'b' }]);
    expect(o.meta?.maxCombo).toBe(2);
  });

  it('start resets everything', () => {
    const r = new InteractiveRound<string>();
    r.start(['a', 'b']);
    r.answer(false, { prompt: 'x', correctAnswer: 'y', given: null });
    r.start(['c']);
    expect(r.index()).toBe(0);
    expect(r.outcome({ gameType: 'fraction', gameKey: 'k', title: 'T', grade: null }).mistakes).toEqual([]);
  });
});
