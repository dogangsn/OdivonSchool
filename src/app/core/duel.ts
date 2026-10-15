import { GameProblem } from '../games/game-models';
import { Difficulty, SpeedPreset, generateProblem } from '../games/math-generator';
import { LiveQuestion } from '../models/live';
import { DuelPlayer } from '../models/duel';

export const DUEL_BASE_POINTS = 100;
export const DUEL_MAX_BONUS = 50;
/** Answers within this many seconds earn a speed bonus. */
export const DUEL_BONUS_WINDOW_MS = 10_000;
export const DUEL_MAX_QUESTIONS = 30;
export const DUEL_MAX_INVITED = 40;
export const DUEL_SECONDS_PER_QUESTION = 15;

/** 100 for a right answer plus up to 50 for answering quickly. */
export function duelPoints(correct: boolean, elapsedMs: number): number {
  if (!correct) return 0;
  const left = Math.max(0, DUEL_BONUS_WINDOW_MS - Math.max(0, elapsedMs));
  return DUEL_BASE_POINTS + Math.round((DUEL_MAX_BONUS * left) / DUEL_BONUS_WINDOW_MS);
}

/** Most points first; on a tie, more correct, then the faster finisher. */
export function rankDuelPlayers(players: DuelPlayer[]): DuelPlayer[] {
  return [...players].sort(
    (a, b) =>
      b.score - a.score ||
      b.correct - a.correct ||
      (a.done ? a.durationMs : Infinity) - (b.done ? b.durationMs : Infinity) ||
      a.joinedAt - b.joinedAt
  );
}

export function problemToQuestion(p: GameProblem): LiveQuestion {
  return {
    prompt: p.text,
    options: [...p.options],
    correctIndex: Math.max(0, p.options.indexOf(p.answer)),
    explanation: p.explanation ?? '',
  };
}

/** Hız Turu questions that get harder through the set (same for every player). */
export function speedDuelQuestions(preset: SpeedPreset, count: number, rng: () => number = Math.random): LiveQuestion[] {
  const list: LiveQuestion[] = [];
  const seen = new Set<string>();
  for (let i = 0, guard = 0; list.length < count && guard < count * 20; guard++) {
    const d: Difficulty = i < count * 0.4 ? 1 : i < count * 0.7 ? 2 : 3;
    const p = generateProblem(preset, d, rng);
    if (seen.has(p.text)) continue;
    seen.add(p.text);
    list.push(problemToQuestion(p));
    i++;
  }
  return list;
}

export function duelPath(classId: string, duelId: string): string {
  return `/duello/${classId}/${duelId}`;
}

export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** Seconds left in a running duel (null until it starts). */
export function secondsLeft(startedAtMs: number | null, timeLimitSec: number, now: number): number | null {
  if (startedAtMs == null) return null;
  return Math.max(0, Math.ceil((startedAtMs + timeLimitSec * 1000 - now) / 1000));
}

/** Every player who joined has finished (or time ran out for all). */
export function everyoneDone(joined: string[], players: DuelPlayer[]): boolean {
  if (joined.length === 0) return false;
  const byUid = new Map(players.map((p) => [p.uid, p]));
  return joined.every((uid) => byUid.get(uid)?.done);
}
