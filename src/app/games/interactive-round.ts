import { computed, signal } from '@angular/core';
import { GameMistake, GameOutcome, GameType } from './game-models';
import { quizStars } from './scoring';

/**
 * Shared bookkeeping for the "Etkileşimli Matematik" games (Saat Ustası,
 * Sayı Doğrusu, Kesir Pizzası): 10 problems, one try each, a small streak
 * bonus, and the usual stars / mistakes outcome.
 */
export const ROUND_SIZE = 10;

export type Rng = () => number;

export function randInt(rng: Rng, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export function randPick<T>(rng: Rng, list: readonly T[]): T {
  return list[Math.floor(rng() * list.length)];
}

/** Points for a correct answer; `streak` counts this answer too (1, 2, 3...). */
export function roundPoints(streak: number): number {
  return 100 + 20 * Math.min(Math.max(streak - 1, 0), 4);
}

export interface RoundMeta {
  gameType: GameType;
  gameKey: string;
  title: string;
  grade: number | null;
}

/** Signals + counters for one 10-problem round. */
export class InteractiveRound<P> {
  readonly problems = signal<P[]>([]);
  readonly index = signal(0);
  readonly score = signal(0);
  readonly correct = signal(0);
  readonly streak = signal(0);
  readonly lastPoints = signal(0);

  readonly current = computed(() => this.problems()[this.index()] ?? null);
  readonly isLast = computed(() => this.index() >= this.problems().length - 1);
  readonly total = computed(() => this.problems().length);

  private mistakes: GameMistake[] = [];
  private maxCombo = 0;
  private startedAt = 0;

  start(problems: P[], now = Date.now()) {
    this.problems.set(problems);
    this.index.set(0);
    this.score.set(0);
    this.correct.set(0);
    this.streak.set(0);
    this.lastPoints.set(0);
    this.mistakes = [];
    this.maxCombo = 0;
    this.startedAt = now;
  }

  /** Records the answer to the current problem; returns the points earned. */
  answer(ok: boolean, mistake?: GameMistake): number {
    if (ok) {
      const streak = this.streak() + 1;
      const pts = roundPoints(streak);
      this.streak.set(streak);
      this.maxCombo = Math.max(this.maxCombo, streak);
      this.correct.update((n) => n + 1);
      this.score.update((s) => s + pts);
      this.lastPoints.set(pts);
      return pts;
    }
    this.streak.set(0);
    this.lastPoints.set(0);
    if (mistake) this.mistakes.push(mistake);
    return 0;
  }

  /** Moves to the next problem; false when the round is over. */
  advance(): boolean {
    if (this.isLast()) return false;
    this.index.update((i) => i + 1);
    return true;
  }

  outcome(meta: RoundMeta, now = Date.now()): GameOutcome {
    const total = this.problems().length;
    return {
      gameType: meta.gameType,
      gameKey: meta.gameKey,
      title: meta.title,
      subject: 'Matematik',
      grade: meta.grade,
      score: this.score(),
      stars: quizStars(this.correct(), total),
      correct: this.correct(),
      total,
      durationMs: now - this.startedAt,
      mistakes: this.mistakes.slice(),
      meta: { maxCombo: this.maxCombo },
    };
  }
}
