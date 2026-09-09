export interface AnsweredQuestion {
  questionId: string;
  selectedOptionId: string | null;
  isCorrect: boolean;
  timeSpentSeconds: number;
}

export interface TestAttempt {
  id: string;
  userId: string;
  categoryId: string;
  level: string;
  subject: string;
  startedAt: number;
  completedAt?: number;
  answers: AnsweredQuestion[];
  correctCount: number;
  totalCount: number;
  successRate: number; // 0-100
}
