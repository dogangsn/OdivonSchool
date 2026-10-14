import { Question } from '../models/question';
import { Assignment, MatchPair, QuizItem } from '../models/classroom';
import { MatchSet } from './match-sets';

const OPTION_IDS = ['a', 'b', 'c', 'd', 'e'];

/** A teacher's questions in the shape the Bilgi Yarışması game plays. */
export function quizItemsToQuestions(items: QuizItem[], subject: string, idPrefix = 'q'): Question[] {
  return items.map((item, i) => ({
    id: `${idPrefix}-${i}`,
    categoryId: '',
    level: '',
    subject,
    prompt: item.prompt,
    options: item.options.map((text, j) => ({ id: OPTION_IDS[j], text })),
    correctOptionId: OPTION_IDS[item.correctIndex],
    explanation: item.explanation,
    difficulty: 1,
    source: 'manual',
    reviewStatus: 'approved',
    createdAt: 0,
    usageCount: 0,
    correctCount: 0,
  }));
}

/** A teacher's pairs as a set for the Eşleştir game. */
export function pairsToMatchSet(id: string, title: string, subject: string, pairs: MatchPair[]): MatchSet {
  return {
    id,
    title,
    description: 'Öğretmeninin hazırladığı eşleştirme seti',
    emoji: '🧑‍🏫',
    subject,
    grades: [],
    pairs: pairs.map((p) => [p.a, p.b] as [string, string]),
  };
}

export function assignmentMatchSet(a: Assignment): MatchSet {
  return pairsToMatchSet(`odev-${a.id}`, a.title, a.subject, a.pairs ?? []);
}

/** Problems with a teacher's quiz before saving; empty = valid. */
export function validateQuizItems(items: QuizItem[]): string[] {
  const errors: string[] = [];
  if (items.length === 0) errors.push('En az bir soru ekleyin.');
  items.forEach((item, i) => {
    const n = i + 1;
    if (!item.prompt.trim()) errors.push(`${n}. sorunun metni boş.`);
    const filled = item.options.filter((o) => o.trim());
    if (filled.length < 2) errors.push(`${n}. soruda en az iki şık olmalı.`);
    if (item.options.some((o) => !o.trim())) errors.push(`${n}. soruda boş şık var; boş şıkları silin.`);
    if (!item.options[item.correctIndex]?.trim()) errors.push(`${n}. soruda doğru şıkkı işaretleyin.`);
    if (new Set(item.options.map((o) => o.trim().toLocaleLowerCase('tr'))).size !== item.options.length) {
      errors.push(`${n}. soruda aynı şık iki kez yazılmış.`);
    }
  });
  return errors;
}

export function validatePairs(pairs: MatchPair[]): string[] {
  const errors: string[] = [];
  if (pairs.length < 3) errors.push('En az 3 eşleşme ekleyin.');
  if (pairs.some((p) => !p.a.trim() || !p.b.trim())) errors.push('Boş kart var; her eşleşmenin iki tarafını doldurun.');
  const texts = pairs.flatMap((p) => [p.a.trim().toLocaleLowerCase('tr'), p.b.trim().toLocaleLowerCase('tr')]);
  if (new Set(texts).size !== texts.length) errors.push('Aynı kelime iki kartta geçiyor; kartlar birbirinden farklı olmalı.');
  return errors;
}
