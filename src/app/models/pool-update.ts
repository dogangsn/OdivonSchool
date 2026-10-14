import { EducationLevel } from './test-category';

/** "Havuza yeni soru eklendi" notice, one per category per approval action. */
export interface PoolUpdate {
  id: string;
  level: EducationLevel;
  /** Grades the category is taught in; empty = every grade of the level. */
  grades: number[];
  categoryId: string;
  subject: string;
  topic: string;
  count: number;
  createdAt: number;
}
