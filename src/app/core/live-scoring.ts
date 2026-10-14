import { LeaderEntry, LivePlayer, LiveQuestion } from '../models/live';
import { Question } from '../models/question';
import { QuizItem } from '../models/classroom';

export const LIVE_MAX_POINTS = 1000;
export const LIVE_MIN_POINTS = 500;
/** Extra seconds the rules accept after the timer, for answers still on the way. */
export const LIVE_GRACE_SEC = 2;

/** Correct answers earn 500–1000 points: the faster, the more. */
export function livePoints(correct: boolean, elapsedMs: number, durationSec: number): number {
  if (!correct) return 0;
  const ratio = Math.min(1, Math.max(0, elapsedMs / (durationSec * 1000)));
  return Math.round(LIVE_MAX_POINTS - (LIVE_MAX_POINTS - LIVE_MIN_POINTS) * ratio);
}

export interface ScoredAnswer {
  uid: string;
  choice: number;
  answeredAtMs: number;
}

export interface QuestionScore {
  players: Record<string, LivePlayer>;
  counts: number[];
  leaderboard: LeaderEntry[];
}

/**
 * Applies one question's answers to the running scores. Players who did not
 * answer keep their score; ranks are recomputed for everyone.
 */
export function scoreQuestion(
  players: Record<string, LivePlayer>,
  answers: ScoredAnswer[],
  question: LiveQuestion,
  startedAtMs: number,
  durationSec: number,
  top = 5
): QuestionScore {
  const counts = question.options.map(() => 0);
  const byUid = new Map<string, ScoredAnswer>();
  for (const a of answers) {
    if (!players[a.uid] || byUid.has(a.uid)) continue;
    byUid.set(a.uid, a);
    if (a.choice >= 0 && a.choice < counts.length) counts[a.choice]++;
  }

  const next: Record<string, LivePlayer> = {};
  for (const [uid, p] of Object.entries(players)) {
    const a = byUid.get(uid);
    const correct = a ? a.choice === question.correctIndex : null;
    const gained = a ? livePoints(!!correct, a.answeredAtMs - startedAtMs, durationSec) : 0;
    next[uid] = {
      ...p,
      score: p.score + gained,
      correct: p.correct + (correct ? 1 : 0),
      lastGained: gained,
      lastCorrect: correct,
    };
  }

  const ranked = rankPlayers(next);
  return {
    players: next,
    counts,
    leaderboard: ranked.slice(0, top).map((p) => ({
      uid: p.uid,
      name: p.displayName,
      score: p.score,
      correct: p.correct,
      gained: p.lastGained,
    })),
  };
}

/** Sorts by score (ties: more correct, then name) and writes `rank` (ties share it). */
export function rankPlayers(players: Record<string, LivePlayer>): LivePlayer[] {
  const list = Object.values(players).sort(
    (a, b) => b.score - a.score || b.correct - a.correct || a.displayName.localeCompare(b.displayName, 'tr')
  );
  list.forEach((p, i) => {
    const prev = list[i - 1];
    p.rank = prev && prev.score === p.score && prev.correct === p.correct ? prev.rank : i + 1;
  });
  return list;
}

export function poolToLive(q: Question): LiveQuestion {
  return {
    prompt: q.prompt,
    options: q.options.map((o) => o.text),
    correctIndex: Math.max(0, q.options.findIndex((o) => o.id === q.correctOptionId)),
    explanation: q.explanation ?? '',
  };
}

export function quizItemToLive(item: QuizItem): LiveQuestion {
  return {
    prompt: item.prompt,
    options: [...item.options],
    correctIndex: item.correctIndex,
    explanation: item.explanation ?? '',
  };
}

/** ISO week key such as "2026-W42"; the class league resets every Monday. */
export function isoWeekKey(ts: number): string {
  const d = new Date(ts);
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((date.getTime() - yearStart) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Firestore Timestamp, Date or number → ms. */
export function toMillis(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  const v = value as { toMillis?: () => number };
  return typeof v.toMillis === 'function' ? v.toMillis() : null;
}
