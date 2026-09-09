export type EducationLevel = 'ilkokul' | 'ortaokul' | 'lise' | 'kpss';

export interface TestCategory {
  id: string;
  level: EducationLevel;
  subject: string;      // e.g. "Matematik", "Türkçe", "Genel Yetenek"
  topic: string;        // e.g. "Kesirler", "Paragraf"
  description?: string;
  order: number;
}
