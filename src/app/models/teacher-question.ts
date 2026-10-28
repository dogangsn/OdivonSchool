/**
 * Öğretmen soru bankası and sınavlar.
 *
 * A teacher writes questions tied to a sınıf, ders, MEB konusu (category) and
 * kazanım. They can put them in exams for their classes, and offer them to
 * the shared pool: a copy goes to `questions/t_<id>` as a draft and only goes
 * live after an admin approves it.
 */

export const TEACHER_OPTION_COUNT = 4;
export const OPTION_IDS = ['a', 'b', 'c', 'd'] as const;
export const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

/** teacherQuestions/{id} — only the owner reads and writes it. */
export interface TeacherQuestion {
  id: string;
  ownerId: string;
  ownerName: string;
  grade: number;
  level: string;
  subject: string;
  categoryId: string;
  topic: string;
  outcomeCode: string | null;
  outcomeText: string | null;
  prompt: string;
  options: string[]; // always 4 (A-D)
  correctIndex: number;
  explanation: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  /** Set when the teacher offered the question to the shared pool. */
  poolSubmittedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export type TeacherQuestionDraft = Omit<
  TeacherQuestion,
  'id' | 'ownerId' | 'ownerName' | 'poolSubmittedAt' | 'createdAt' | 'updatedAt'
>;

/** Where a pooled teacher question stands, read from its `questions` copy. */
export type PoolState = 'none' | 'pending' | 'approved' | 'removed';

export const POOL_STATE_LABELS: Record<PoolState, string> = {
  none: 'Sadece bankamda',
  pending: 'Havuz onayı bekliyor',
  approved: 'Ortak havuzda',
  removed: 'Havuza alınmadı',
};

/** Pool copy id: one per teacher question, so a question can't be offered twice. */
export function poolIdFor(teacherQuestionId: string): string {
  return `t_${teacherQuestionId}`;
}

/** One question inside an exam assignment; the answer key is stored apart. */
export interface ExamQuestion {
  prompt: string;
  options: string[];
  subject: string;
  categoryId: string | null;
  topic: string | null;
  outcomeCode: string | null;
  /** Set when the question came from the shared pool (enables akıllı tekrar). */
  poolId: string | null;
}

/** classes/{cid}/assignments/{aid}/examKey/key — readable after you hand in. */
export interface ExamKey {
  correct: number[];
  explanations: string[];
}

/** classes/{cid}/assignments/{aid}/examAnswers/{uid} — handed in once. */
export interface ExamAnswerSheet {
  uid: string;
  displayName: string;
  /** Chosen option index per question, -1 = boş. */
  answers: number[];
  startedAt: number;
  submittedAt: number;
  durationMs: number;
}

export const EXAM_MAX_QUESTIONS = 50;
export const EXAM_DURATIONS = [0, 20, 30, 40, 60, 80];
