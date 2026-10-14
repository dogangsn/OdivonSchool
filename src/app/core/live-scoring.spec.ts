import { LivePlayer, LiveQuestion } from '../models/live';
import { isoWeekKey, livePoints, poolToLive, rankPlayers, scoreQuestion } from './live-scoring';

function player(uid: string, score = 0, correct = 0): LivePlayer {
  return { uid, displayName: uid, joinedAt: 0, score, correct, lastGained: 0, lastCorrect: null, rank: 0 };
}

const Q: LiveQuestion = { prompt: '2 + 2', options: ['3', '4', '5', '6'], correctIndex: 1, explanation: '' };

describe('live scoring', () => {
  it('gives 1000 for an instant correct answer and 500 at the buzzer', () => {
    expect(livePoints(true, 0, 20)).toBe(1000);
    expect(livePoints(true, 10000, 20)).toBe(750);
    expect(livePoints(true, 25000, 20)).toBe(500);
    expect(livePoints(false, 0, 20)).toBe(0);
  });

  it('scores a question, counts choices and ignores strangers and duplicates', () => {
    const players = { a: player('a'), b: player('b', 900, 1), c: player('c') };
    const result = scoreQuestion(
      players,
      [
        { uid: 'a', choice: 1, answeredAtMs: 1000 },
        { uid: 'a', choice: 0, answeredAtMs: 1500 },
        { uid: 'b', choice: 2, answeredAtMs: 1200 },
        { uid: 'x', choice: 1, answeredAtMs: 1000 },
      ],
      Q,
      1000,
      20
    );
    expect(result.counts).toEqual([0, 1, 1, 0]);
    expect(result.players['a'].score).toBe(1000);
    expect(result.players['a'].lastCorrect).toBeTrue();
    expect(result.players['b'].score).toBe(900);
    expect(result.players['b'].lastCorrect).toBeFalse();
    expect(result.players['c'].lastCorrect).toBeNull();
    expect(result.leaderboard.map((e) => e.uid)).toEqual(['a', 'b', 'c']);
    expect(players['a'].score).toBe(0); // input untouched
  });

  it('shares ranks on ties', () => {
    const ranked = rankPlayers({ a: player('a', 500, 1), b: player('b', 500, 1), c: player('c', 100, 1) });
    expect(ranked.map((p) => p.rank)).toEqual([1, 1, 3]);
  });

  it('maps pool questions to the correct option index', () => {
    const live = poolToLive({
      prompt: 'p',
      options: [
        { id: 'a', text: 'A' },
        { id: 'b', text: 'B' },
      ],
      correctOptionId: 'b',
      explanation: 'e',
    } as any);
    expect(live).toEqual({ prompt: 'p', options: ['A', 'B'], correctIndex: 1, explanation: 'e' });
  });

  it('builds ISO week keys', () => {
    expect(isoWeekKey(new Date(2026, 9, 14).getTime())).toBe('2026-W42');
    expect(isoWeekKey(new Date(2026, 9, 12).getTime())).toBe('2026-W42'); // Monday
    expect(isoWeekKey(new Date(2026, 9, 11).getTime())).toBe('2026-W41'); // Sunday
    expect(isoWeekKey(new Date(2021, 0, 1).getTime())).toBe('2020-W53');
  });
});
