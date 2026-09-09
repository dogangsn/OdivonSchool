export interface QuestionOption {
  id: string;
  text: string;
}

export interface GeneratedQuestion {
  prompt: string;
  options: QuestionOption[];
  correctOptionId: string;
  explanation: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
}

export interface QuestionDoc extends GeneratedQuestion {
  categoryId: string;
  level: string;
  subject: string;
  source: 'manual' | 'ai-generated';
  aiModel?: string;
  reviewStatus: 'draft' | 'approved' | 'rejected';
  createdAt: number;
  usageCount: number;
  correctCount: number;
}
