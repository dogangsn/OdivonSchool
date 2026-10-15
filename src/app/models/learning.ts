/**
 * Akıllı tekrar: each question a student gets wrong becomes a review card.
 * Cards move up a Leitner box every time they are answered right and come
 * back after a growing number of days; a wrong answer sends a card back to
 * box 1. Outcome (kazanım) totals feed the kazanım haritası.
 */

/** users/{uid}/reviewCards/{questionId} */
export interface ReviewCard {
  questionId: string;
  categoryId: string;
  subject: string;
  outcomeCode: string | null;
  /** 1-5; a right answer in box 5 retires the card. */
  box: number;
  dueAt: number;
  wrongCount: number;
  updatedAt: number;
}

/** One kazanım's running totals. */
export interface OutcomeStat {
  code: string;
  categoryId: string;
  correct: number;
  total: number;
  lastAt: number;
}

/** users/{uid}/learning/outcomes */
export interface OutcomeStatsDoc {
  outcomes: Record<string, OutcomeStat>;
  updatedAt: number;
}

/** A pool question the student just answered. */
export interface AnsweredPoolQuestion {
  questionId: string;
  categoryId: string;
  subject: string;
  outcomeCode: string | null;
  correct: boolean;
}

export type OutcomeMastery = 'none' | 'weak' | 'learning' | 'mastered';
