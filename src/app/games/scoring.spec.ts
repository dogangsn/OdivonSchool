import { GameOutcome } from './game-models';
import {
  comboMultiplier,
  levelForXp,
  levelProgress,
  matchStars,
  newBadges,
  nextStreak,
  quizStars,
  sortStars,
  speedStars,
  xpForOutcome,
} from './scoring';

function outcome(partial: Partial<GameOutcome>): GameOutcome {
  return {
    gameType: 'speed',
    gameKey: 'g3-carpim-tablosu',
    title: 'Test',
    subject: 'Matematik',
    grade: 3,
    score: 0,
    stars: 0,
    correct: 0,
    total: 0,
    durationMs: 0,
    mistakes: [],
    ...partial,
  };
}

describe('scoring', () => {
  it('stars reward accuracy', () => {
    expect(speedStars(20, 21)).toBe(3);
    expect(speedStars(20, 40)).toBe(1); // spamming answers doesn't earn stars
    expect(speedStars(9, 12)).toBe(2);
    expect(speedStars(2, 2)).toBe(0);
    expect(quizStars(9, 10)).toBe(3);
    expect(quizStars(7, 10)).toBe(2);
    expect(quizStars(0, 10)).toBe(0);
    expect(matchStars(0)).toBe(3);
    expect(matchStars(5)).toBe(2);
    expect(matchStars(12)).toBe(1);
    expect(sortStars(0, 10)).toBe(3);
    expect(sortStars(1, 10)).toBe(3);
    expect(sortStars(3, 10)).toBe(2);
    expect(sortStars(4, 10)).toBe(1);
  });

  it('new game types have their own perfect-round badges', () => {
    const tf = outcome({ gameType: 'truefalse', correct: 10, total: 10 });
    expect(newBadges({ outcome: tf, xpTotal: 0, streakDays: 1 }, []).map((b) => b.id)).toContain('dogru-dedektif');
    const sortClean = outcome({ gameType: 'sort', correct: 10, total: 10, mistakes: [] });
    expect(newBadges({ outcome: sortClean, xpTotal: 0, streakDays: 1 }, []).map((b) => b.id)).toContain('duzen-ustasi');
    const sortMessy = outcome({ gameType: 'sort', correct: 9, total: 10, mistakes: [{ prompt: 'taş', correctAnswer: 'Cansız', given: 'Canlı' }] });
    expect(newBadges({ outcome: sortMessy, xpTotal: 0, streakDays: 1 }, []).map((b) => b.id)).not.toContain('duzen-ustasi');
  });

  it('combo multiplier steps every 3 and caps at 4', () => {
    expect([0, 2, 3, 6, 9, 30].map(comboMultiplier)).toEqual([1, 1, 2, 3, 4, 4]);
  });

  it('xp is bounded so a single game stays under the Firestore rule limit', () => {
    expect(xpForOutcome({ score: 100000, stars: 3, correct: 50 })).toBe(300);
    expect(xpForOutcome({ score: 0, stars: 0, correct: 0 })).toBe(2);
    expect(xpForOutcome({ score: 40, stars: 1, correct: 4 })).toBe(14);
  });

  it('levels grow quadratically', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(49)).toBe(1);
    expect(levelForXp(50)).toBe(2);
    expect(levelForXp(200)).toBe(3);
    expect(levelProgress(125)).toBe(50);
  });

  it('daily streak continues only from yesterday', () => {
    const today = new Date(2026, 9, 14, 10);
    expect(nextStreak('2026-10-14', 4, today)).toBe(4);
    expect(nextStreak('2026-10-13', 4, today)).toBe(5);
    expect(nextStreak('2026-10-10', 4, today)).toBe(1);
    expect(nextStreak(undefined, 0, today)).toBe(1);
  });

  it('awards each badge once', () => {
    const o = outcome({ stars: 3, correct: 20, total: 20, meta: { maxCombo: 12 } });
    const first = newBadges({ outcome: o, xpTotal: 600, streakDays: 3 }, []).map((b) => b.id);
    expect(first).toEqual(
      jasmine.arrayContaining(['ilk-adim', 'uc-yildiz', 'seri-3', 'xp-500', 'hiz-ustasi', 'kombo-kral'])
    );
    expect(first).not.toContain('seri-7');
    const again = newBadges({ outcome: o, xpTotal: 700, streakDays: 3 }, first);
    expect(again).toEqual([]);
  });
});
