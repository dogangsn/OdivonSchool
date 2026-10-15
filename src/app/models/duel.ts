import { LiveQuestion } from './live';

/**
 * A düello / karşılaşma inside a class. Everyone plays the same questions at
 * the same time on their own device; each player's app writes its own
 * progress, so classmates see the race as it happens.
 *
 * A student opens one with a link (2 players). A teacher sets one up for
 * chosen students, sends them the link and presses Başlat.
 */
export type DuelStatus = 'waiting' | 'running' | 'finished';

/** classes/{classId}/duels/{duelId} */
export interface Duel {
  id: string;
  classId: string;
  createdBy: string;
  creatorName: string;
  byTeacher: boolean;
  title: string;
  subject: string;
  questions: LiveQuestion[];
  timeLimitSec: number;
  /** Students the teacher picked; empty = anyone in the class with the link. */
  invited: string[];
  /** Players who opened the link and joined, in order. */
  joined: string[];
  maxPlayers: number;
  status: DuelStatus;
  /** Server time Başlat was pressed. */
  startedAt: unknown;
  createdAt: number;
  endedAt: number | null;
}

/** classes/{classId}/duels/{duelId}/players/{uid}, written by that player. */
export interface DuelPlayer {
  uid: string;
  name: string;
  joinedAt: number;
  answered: number;
  correct: number;
  score: number;
  durationMs: number;
  done: boolean;
}

/** classes/{classId}/messages/{id}: a note from the teacher. */
export interface ClassMessage {
  id: string;
  classId: string;
  teacherId: string;
  teacherName: string;
  text: string;
  /** ['all'] for the whole class, otherwise the students' uids. */
  audience: string[];
  /** Optional in-app path such as /duello/abc/xyz. */
  link: string | null;
  linkLabel: string | null;
  createdAt: number;
}

export const AUDIENCE_ALL = 'all';
