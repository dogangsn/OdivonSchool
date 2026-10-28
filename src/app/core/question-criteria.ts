import { Question } from '../models/question';
import { TestCategory } from '../models/test-category';
import {
  ExamKey,
  OPTION_IDS,
  TEACHER_OPTION_COUNT,
  TeacherQuestion,
  TeacherQuestionDraft,
  poolIdFor,
} from '../models/teacher-question';

export const PROMPT_MIN = 10;
export const PROMPT_MAX = 1000;
export const OPTION_MAX = 300;
export const EXPLANATION_MAX = 1000;
/** Havuz için: soru kökü ve açıklama bu kadar uzun olmalı. */
export const POOL_PROMPT_MIN = 15;
export const POOL_EXPLANATION_MIN = 20;
/** Word overlap at or above this counts as the same question. */
export const DUPLICATE_SIMILARITY = 0.85;

export interface CriterionResult {
  id: string;
  label: string;
  ok: boolean;
}

/** Lowercased (Turkish), punctuation removed, single spaces. */
export function normalizeText(text: string): string {
  return text
    .toLocaleLowerCase('tr')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function words(text: string): Set<string> {
  return new Set(normalizeText(text).split(' ').filter((w) => w.length > 1));
}

/** Jaccard similarity of the two texts' word sets, 0-1. */
export function similarity(a: string, b: string): number {
  const wa = words(a);
  const wb = words(b);
  if (wa.size === 0 || wb.size === 0) return normalizeText(a) === normalizeText(b) ? 1 : 0;
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared++;
  return shared / (wa.size + wb.size - shared);
}

/** The most similar existing prompt, if it is close enough to be the same question. */
export function findDuplicate<T extends { prompt: string }>(prompt: string, existing: T[]): T | null {
  let best: T | null = null;
  let bestScore = 0;
  for (const q of existing) {
    const s = similarity(prompt, q.prompt);
    if (s > bestScore) {
      best = q;
      bestScore = s;
    }
  }
  return bestScore >= DUPLICATE_SIMILARITY ? best : null;
}

function filledOptions(q: Pick<TeacherQuestionDraft, 'options'>): string[] {
  return q.options.map((o) => o.trim());
}

function optionsDistinct(q: Pick<TeacherQuestionDraft, 'options'>): boolean {
  const norm = filledOptions(q).map(normalizeText);
  return new Set(norm).size === norm.length;
}

/** Errors that stop a question from being saved at all (bank and exams). */
export function validateQuestion(q: TeacherQuestionDraft): string[] {
  const errs: string[] = [];
  if (!q.grade) errs.push('Sınıf seçin.');
  if (!q.subject) errs.push('Ders seçin.');
  if (!q.categoryId) errs.push('Müfredattan bir konu seçin.');
  const prompt = q.prompt.trim();
  if (prompt.length < PROMPT_MIN) errs.push(`Soru metni en az ${PROMPT_MIN} karakter olmalı.`);
  if (prompt.length > PROMPT_MAX) errs.push(`Soru metni en fazla ${PROMPT_MAX} karakter olabilir.`);
  const opts = filledOptions(q);
  if (opts.length !== TEACHER_OPTION_COUNT || opts.some((o) => !o)) errs.push('Dört şıkkın hepsini doldurun.');
  else if (!optionsDistinct(q)) errs.push('İki şık aynı olamaz.');
  if (opts.some((o) => o.length > OPTION_MAX)) errs.push(`Bir şık en fazla ${OPTION_MAX} karakter olabilir.`);
  if (!(q.correctIndex >= 0 && q.correctIndex < TEACHER_OPTION_COUNT)) errs.push('Doğru şıkkı işaretleyin.');
  if (q.explanation.trim().length > EXPLANATION_MAX) errs.push(`Açıklama en fazla ${EXPLANATION_MAX} karakter olabilir.`);
  return errs;
}

/**
 * Our criteria for the shared pool. All must pass before a teacher's question
 * is offered; an admin still reviews it before students see it.
 */
export function poolCriteria(
  q: TeacherQuestionDraft,
  category: TestCategory | null,
  duplicateOf: { prompt: string } | null
): CriterionResult[] {
  const needsOutcome = (category?.outcomes?.length ?? 0) > 0;
  const opts = filledOptions(q);
  return [
    {
      id: 'curriculum',
      label: 'Sınıf, ders ve müfredat konusu seçildi',
      ok: !!q.grade && !!q.subject && !!q.categoryId && !!category,
    },
    {
      id: 'outcome',
      label: needsOutcome ? 'Konunun kazanımlarından biri seçildi' : 'Kazanım (bu konuda MEB kazanımı yok)',
      ok: !needsOutcome || (!!q.outcomeCode && category!.outcomes!.some((o) => o.code === q.outcomeCode)),
    },
    {
      id: 'prompt',
      label: `Soru kökü açık ve en az ${POOL_PROMPT_MIN} karakter`,
      ok: q.prompt.trim().length >= POOL_PROMPT_MIN && q.prompt.trim().length <= PROMPT_MAX,
    },
    {
      id: 'options',
      label: '4 şık dolu ve hepsi birbirinden farklı',
      ok: opts.length === TEACHER_OPTION_COUNT && opts.every((o) => !!o && o.length <= OPTION_MAX) && optionsDistinct(q),
    },
    {
      id: 'answer',
      label: 'Tek doğru cevap işaretli',
      ok: q.correctIndex >= 0 && q.correctIndex < TEACHER_OPTION_COUNT,
    },
    {
      id: 'explanation',
      label: `Öğretici açıklama yazıldı (en az ${POOL_EXPLANATION_MIN} karakter)`,
      ok: q.explanation.trim().length >= POOL_EXPLANATION_MIN && q.explanation.trim().length <= EXPLANATION_MAX,
    },
    {
      id: 'unique',
      label: 'Havuzda aynı ya da çok benzer bir soru yok',
      ok: !duplicateOf,
    },
  ];
}

export function passesPool(results: CriterionResult[]): boolean {
  return results.every((r) => r.ok);
}

/** The draft copy offered to the shared pool (`questions/t_<id>`). */
export function toPoolQuestion(q: TeacherQuestion, now: number): Omit<Question, 'id'> {
  const pooled: Omit<Question, 'id'> = {
    categoryId: q.categoryId,
    level: q.level,
    subject: q.subject,
    grade: q.grade,
    prompt: q.prompt.trim(),
    options: q.options.map((text, i) => ({ id: OPTION_IDS[i], text: text.trim() })),
    correctOptionId: OPTION_IDS[q.correctIndex],
    explanation: q.explanation.trim(),
    difficulty: q.difficulty,
    source: 'teacher',
    authorId: q.ownerId,
    authorName: q.ownerName.slice(0, 80),
    reviewStatus: 'draft',
    createdAt: now,
    usageCount: 0,
    correctCount: 0,
  };
  if (q.outcomeCode) pooled.outcomeCode = q.outcomeCode;
  return pooled;
}

export { poolIdFor };

// ------------------------------------------------------------------ exams

export interface ExamScore {
  correct: number;
  wrong: number;
  blank: number;
  total: number;
  /** 0-100, rounded. */
  points: number;
  /** Per question: true = doğru, false = yanlış, null = boş. */
  marks: (boolean | null)[];
}

export function scoreExam(answers: number[], key: Pick<ExamKey, 'correct'>): ExamScore {
  const marks = key.correct.map((c, i) => {
    const a = answers[i];
    if (a === undefined || a === null || a < 0) return null;
    return a === c;
  });
  const correct = marks.filter((m) => m === true).length;
  const wrong = marks.filter((m) => m === false).length;
  const total = key.correct.length;
  return {
    correct,
    wrong,
    blank: total - correct - wrong,
    total,
    points: total ? Math.round((correct / total) * 100) : 0,
    marks,
  };
}

/** Deterministic order for one student, so a reload keeps the same order. */
export function shuffledOrder(count: number, seed: string): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const rand = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
  const order = Array.from({ length: count }, (_, i) => i);
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/** Categories a grade can pick: MEB temaları (with kazanımlar) first. */
export function categoriesForGrade(all: TestCategory[], grade: number): TestCategory[] {
  return all
    .filter((c) => c.level !== 'kpss' && (!c.grades?.length || c.grades.includes(grade)))
    .sort((a, b) => {
      const am = a.outcomes?.length ? 0 : 1;
      const bm = b.outcomes?.length ? 0 : 1;
      if (am !== bm) return am - bm;
      return (a.order ?? 0) - (b.order ?? 0);
    });
}

export function subjectsOf(categories: TestCategory[]): string[] {
  return [...new Set(categories.map((c) => c.subject))];
}
