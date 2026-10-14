export type GameType = 'speed' | 'quiz' | 'match' | 'truefalse' | 'sort';

/** A question a game asks; answers are compared as strings. */
export interface GameProblem {
  text: string;
  answer: string;
  options: string[];
  /** Short teaching note shown after a wrong answer. */
  explanation: string;
  /** Optional dot-array picture for multiplication (rows × cols). */
  visual?: { rows: number; cols: number };
}

export interface GameMistake {
  prompt: string;
  correctAnswer: string;
  given: string | null; // null = süre doldu / boş
}

/** What a finished game reports, before XP/badges are applied. */
export interface GameOutcome {
  gameType: GameType;
  gameKey: string; // preset id, category id or match set id
  title: string;
  subject: string;
  grade: number | null;
  categoryId?: string;
  score: number;
  stars: 0 | 1 | 2 | 3;
  correct: number;
  total: number;
  durationMs: number;
  mistakes: GameMistake[];
  /** Extra stats some badges look at. */
  meta?: { maxCombo?: number; matchMistakes?: number };
}

export interface GameResultDoc extends Omit<GameOutcome, 'meta'> {
  userId: string;
  createdAt: number;
  classId?: string;
  assignmentId?: string;
}

/** Outcome after XP, streak and badges were applied. */
export interface GameReward {
  xpGained: number;
  xpTotal: number;
  level: number;
  levelProgress: number; // 0-100 towards next level
  streakDays: number;
  newBadges: BadgeDef[];
  saved: boolean; // false for guests
  /** Set when the game was an assignment: whether the teacher got the result. */
  submitted?: boolean;
  /** Teacher preview: nothing was saved on purpose. */
  preview?: boolean;
}

export interface BadgeDef {
  id: string;
  emoji: string;
  title: string;
  description: string;
}
