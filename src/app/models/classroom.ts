import { GameMistake } from '../games/game-models';
import { ExamQuestion } from './teacher-question';

/** A teacher's class. Students join with `joinCode`. */
export interface Classroom {
  id: string;
  teacherId: string;
  teacherName: string;
  name: string;
  grade: number;
  joinCode: string;
  createdAt: number;
  archived?: boolean;
}

/** classes/{classId}/members/{uid} */
export interface ClassMember {
  uid: string;
  displayName: string;
  grade: number | null;
  joinCode: string; // the code used to join (checked by the rules)
  joinedAt: number;
}

/** One multiple-choice question written by a teacher. */
export interface QuizItem {
  prompt: string;
  options: string[]; // 2-5 options
  correctIndex: number;
  explanation: string;
}

export interface MatchPair {
  a: string;
  b: string;
}

export type TeacherContentType = 'quiz' | 'match';

/** teacherContent/{id}: a teacher's own test or matching set. */
export interface TeacherContent {
  id: string;
  ownerId: string;
  type: TeacherContentType;
  title: string;
  subject: string;
  grade: number;
  quizItems?: QuizItem[];
  pairs?: MatchPair[];
  createdAt: number;
  updatedAt: number;
}

export type AssignmentKind = 'custom-quiz' | 'custom-match' | 'pool-quiz' | 'speed' | 'exam';

/**
 * classes/{classId}/assignments/{id}. Custom content is copied into the
 * assignment so students never need access to the teacher's library.
 */
export interface Assignment {
  id: string;
  classId: string;
  teacherId: string;
  kind: AssignmentKind;
  title: string;
  subject: string;
  dueAt: number | null;
  createdAt: number;
  contentId?: string;
  quizItems?: QuizItem[];
  pairs?: MatchPair[];
  categoryId?: string;
  presetId?: string;
  /** kind 'exam': questions without answers (the key lives in examKey/key). */
  examQuestions?: ExamQuestion[];
  questionCount?: number;
  /** Minutes; 0 or missing = no time limit. */
  timeLimitMin?: number;
  /** Show correct answers and explanations after handing in. */
  showAnswers?: boolean;
  /** Each student sees the questions in their own order. */
  shuffle?: boolean;
}

/** classes/{classId}/assignments/{aid}/submissions/{uid}: latest + best try. */
export interface Submission {
  uid: string;
  displayName: string;
  score: number;
  stars: number;
  correct: number;
  total: number;
  durationMs: number;
  bestScore: number;
  bestStars: number;
  attempts: number;
  mistakes: GameMistake[];
  firstCompletedAt: number;
  completedAt: number;
}

/** Which assignment a game is being played for. */
export interface AssignmentRef {
  classId: string;
  assignmentId: string;
}

export const KIND_LABELS: Record<AssignmentKind, string> = {
  'custom-quiz': 'Öğretmen testi',
  'custom-match': 'Eşleştirme seti',
  'pool-quiz': 'Bilgi Yarışması',
  speed: 'Hız Turu',
  exam: 'Sınav',
};

export const SUBJECTS = [
  'Türkçe',
  'Matematik',
  'Hayat Bilgisi',
  'Fen Bilimleri',
  'Sosyal Bilgiler',
  'İngilizce',
  'Din Kültürü',
  'Diğer',
];

/** One topic's running totals inside a student's class progress. */
export interface TopicStat {
  label: string;
  subject: string;
  correct: number;
  total: number;
  lastAt: number;
}

/**
 * classes/{classId}/progress/{uid}: running totals the student's own app keeps
 * for each class they are in (games and tests alike), read by the teacher.
 */
export interface ClassProgress {
  uid: string;
  displayName: string;
  lastActiveAt: number;
  streakDays: number;
  activities: number;
  answered: number;
  correct: number;
  topics: Record<string, TopicStat>;
  /** Kazanım totals from pool questions, keyed by outcomeKey(code). */
  outcomes?: Record<string, { code: string; correct: number; total: number }>;
}

/** A finished game or test, reduced to what the teacher tracks. */
export interface ProgressEntry {
  key: string;
  label: string;
  subject: string;
  correct: number;
  total: number;
}
