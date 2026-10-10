export type EducationLevel = 'ilkokul' | 'ortaokul' | 'lise' | 'kpss';

/** A single MEB learning outcome (öğrenme çıktısı), e.g. MAT.3.2.6. */
export interface LearningOutcome {
  code: string;
  text: string;
}

export interface TestCategory {
  id: string;
  level: EducationLevel;
  subject: string;      // e.g. "Matematik", "Türkçe", "Genel Yetenek"
  topic: string;        // e.g. "Kesirler", "Paragraf" or a MEB tema name
  description?: string;
  order: number;
  /** Grades (1-12) this category is taught in. Missing = all grades of the level (and KPSS). */
  grades?: number[];
  /** Learning outcomes from the MEB Türkiye Yüzyılı Maarif Modeli program, when known. */
  outcomes?: LearningOutcome[];
  /** Link to the official MEB program page the category was built from. */
  sourceUrl?: string;
}

/** Grades shown for each level in the category picker. */
export const LEVEL_GRADES: Record<EducationLevel, number[]> = {
  ilkokul: [1, 2, 3, 4],
  ortaokul: [5, 6, 7, 8],
  lise: [9, 10, 11, 12],
  kpss: [],
};

export function levelForGrade(grade: number): EducationLevel {
  if (grade <= 4) return 'ilkokul';
  if (grade <= 8) return 'ortaokul';
  return 'lise';
}
