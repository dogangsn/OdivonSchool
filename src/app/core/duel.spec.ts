import {
  DUEL_BASE_POINTS,
  DUEL_MAX_BONUS,
  duelPath,
  duelPoints,
  everyoneDone,
  problemToQuestion,
  rankDuelPlayers,
  secondsLeft,
  speedDuelQuestions,
  whatsappShareUrl,
} from './duel';
import { presetById } from '../games/math-generator';
import { DuelPlayer } from '../models/duel';

function player(uid: string, over: Partial<DuelPlayer> = {}): DuelPlayer {
  return { uid, name: uid, joinedAt: 0, answered: 0, correct: 0, score: 0, durationMs: 0, done: false, ...over };
}

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

describe('duel', () => {
  it('scores a wrong answer as 0 and a fast right one with the full bonus', () => {
    expect(duelPoints(false, 100)).toBe(0);
    expect(duelPoints(true, 0)).toBe(DUEL_BASE_POINTS + DUEL_MAX_BONUS);
    expect(duelPoints(true, 5000)).toBe(DUEL_BASE_POINTS + DUEL_MAX_BONUS / 2);
    expect(duelPoints(true, 60_000)).toBe(DUEL_BASE_POINTS);
  });

  it('ranks by score, then correct answers, then finishing time', () => {
    const ranked = rankDuelPlayers([
      player('a', { score: 500, correct: 4, done: true, durationMs: 9000 }),
      player('b', { score: 500, correct: 4, done: true, durationMs: 7000 }),
      player('c', { score: 700, correct: 5 }),
      player('d', { score: 500, correct: 5 }),
    ]);
    expect(ranked.map((p) => p.uid)).toEqual(['c', 'd', 'b', 'a']);
  });

  it('turns a generated problem into a question with the right index', () => {
    const q = problemToQuestion({ text: '2 + 3', answer: '5', options: ['4', '5', '6', '7'], explanation: '' });
    expect(q.correctIndex).toBe(1);
    expect(q.options[q.correctIndex]).toBe('5');
  });

  it('builds the requested number of distinct speed questions', () => {
    const qs = speedDuelQuestions(presetById('g3-carpim-tablosu')!, 10, seeded(7));
    expect(qs.length).toBe(10);
    expect(new Set(qs.map((q) => q.prompt)).size).toBe(10);
    for (const q of qs) expect(q.options[q.correctIndex]).toBeDefined();
  });

  it('builds links and counts down', () => {
    expect(duelPath('c1', 'd1')).toBe('/duello/c1/d1');
    expect(whatsappShareUrl('a b&c')).toBe('https://wa.me/?text=a%20b%26c');
    expect(secondsLeft(null, 60, 0)).toBeNull();
    expect(secondsLeft(1000, 60, 31_000)).toBe(30);
    expect(secondsLeft(1000, 60, 999_999)).toBe(0);
  });

  it('knows when every joined player has finished', () => {
    expect(everyoneDone([], [])).toBeFalse();
    expect(everyoneDone(['a', 'b'], [player('a', { done: true })])).toBeFalse();
    expect(everyoneDone(['a', 'b'], [player('a', { done: true }), player('b', { done: true })])).toBeTrue();
  });
});
