import { GameMistake } from '../games/game-models';

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

export type AssignmentKind = 'custom-quiz' | 'custom-match' | 'pool-quiz' | 'speed';

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
