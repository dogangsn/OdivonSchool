/**
 * Live class competition (Kahoot style). The teacher's screen is the referee:
 * questions with their answers stay in the teacher's private doc, students
 * only ever see the current question, and the teacher's app scores answers
 * using the server time each answer was written.
 */

export type LiveStatus = 'lobby' | 'question' | 'reveal' | 'finished';

/** A question as students see it: no correct answer. */
export interface LivePublicQuestion {
  prompt: string;
  options: string[];
  /** Firestore server timestamp (ms in the app after conversion). */
  startedAt: unknown;
  durationSec: number;
}

export interface LiveQuestion {
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface LeaderEntry {
  uid: string;
  name: string;
  score: number;
  correct: number;
  gained: number;
}

/** classes/{classId}/live/{sessionId} */
export interface LiveSession {
  id: string;
  classId: string;
  teacherId: string;
  title: string;
  subject: string;
  /** Pool category when the questions came from the pool (for tracking). */
  categoryId: string | null;
  status: LiveStatus;
  questionIndex: number;
  questionCount: number;
  durationSec: number;
  question: LivePublicQuestion | null;
  reveal: { correctIndex: number; counts: number[]; explanation: string } | null;
  leaderboard: LeaderEntry[];
  players: number;
  createdAt: number;
  endedAt: number | null;
}

/** classes/{classId}/live/{sessionId}/private/questions — teacher only. */
export interface LivePrivate {
  questions: LiveQuestion[];
}

/** classes/{classId}/live/{sessionId}/players/{uid} — scores written by the teacher. */
export interface LivePlayer {
  uid: string;
  displayName: string;
  joinedAt: number;
  score: number;
  correct: number;
  lastGained: number;
  lastCorrect: boolean | null;
  rank: number;
}

/** classes/{classId}/live/{sessionId}/answers/{q}_{uid} — one per question, no edits. */
export interface LiveAnswer {
  uid: string;
  q: number;
  choice: number;
  answeredAt: unknown; // server timestamp, enforced by the rules
}

/** classes/{classId}/league/{uid}: this week's XP inside the class. */
export interface LeagueEntry {
  uid: string;
  displayName: string;
  week: string;
  xp: number;
}
