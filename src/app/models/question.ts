export interface QuestionOption {
  id: string;   // 'a' | 'b' | 'c' | 'd' | 'e'
  text: string;
}

export interface Question {
  id: string;
  categoryId: string;       // ref -> TestCategory.id
  level: string;            // denormalized EducationLevel for querying
  subject: string;          // denormalized subject
  prompt: string;
  options: QuestionOption[];
  correctOptionId: string;
  explanation: string;      // öğretici metin - shown when the user answers incorrectly
  difficulty: 1 | 2 | 3 | 4 | 5;
  outcomeCode?: string;     // MEB öğrenme çıktısı kodu this question measures, e.g. MAT.3.2.6
  source: 'manual' | 'ai-generated' | 'teacher';
  aiModel?: string;         // which AI generated it, if applicable
  authorId?: string;        // source 'teacher': who wrote it
  authorName?: string;
  grade?: number;
  reviewStatus: 'draft' | 'approved' | 'rejected'; // admin approval gate for AI questions
  createdAt: number;
  usageCount: number;       // how many times served
  correctCount: number;     // how many times answered correctly
}
