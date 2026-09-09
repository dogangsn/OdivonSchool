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
  source: 'manual' | 'ai-generated';
  aiModel?: string;         // which AI generated it, if applicable
  reviewStatus: 'draft' | 'approved' | 'rejected'; // admin approval gate for AI questions
  createdAt: number;
  usageCount: number;       // how many times served
  correctCount: number;     // how many times answered correctly
}
