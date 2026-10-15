import { AnsweredPoolQuestion, OutcomeMastery, OutcomeStat, ReviewCard } from '../models/learning';

const DAY = 24 * 60 * 60 * 1000;
/** Days until a card in box n (1-5) comes back. */
export const BOX_INTERVAL_DAYS = [1, 2, 4, 8, 16];
export const MAX_BOX = BOX_INTERVAL_DAYS.length;
export const DAILY_REVIEW_SIZE = 10;
/** Answers needed before a kazanım counts as mastered or weak. */
export const MIN_OUTCOME_ANSWERS = 3;

/** Local midnight `days` days after `now`, so cards come back at the start of a day. */
export function dayStartAfter(now: number, days: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

export type CardChange = { kind: 'save'; card: ReviewCard } | { kind: 'retire' } | { kind: 'none' };

/**
 * What happens to a question's card after an answer:
 * - wrong: new card or back to box 1, due tomorrow;
 * - right with a card: one box up (retired after the last box);
 * - right without a card: nothing to review.
 */
export function nextCard(prev: ReviewCard | null, a: AnsweredPoolQuestion, now: number): CardChange {
  if (!a.correct) {
    return {
      kind: 'save',
      card: {
        questionId: a.questionId,
        categoryId: a.categoryId,
        subject: a.subject.slice(0, 60),
        outcomeCode: a.outcomeCode,
        box: 1,
        dueAt: dayStartAfter(now, BOX_INTERVAL_DAYS[0]),
        wrongCount: (prev?.wrongCount ?? 0) + 1,
        updatedAt: now,
      },
    };
  }
  if (!prev) return { kind: 'none' };
  // Answered right before it was due (e.g. in a normal test): keep the schedule.
  if (prev.dueAt > now) return { kind: 'none' };
  if (prev.box >= MAX_BOX) return { kind: 'retire' };
  const box = prev.box + 1;
  return {
    kind: 'save',
    card: { ...prev, box, dueAt: dayStartAfter(now, BOX_INTERVAL_DAYS[box - 1]), updatedAt: now },
  };
}

/** Today's review: due cards, the most forgotten (lowest box) and oldest first. */
export function dueCards(cards: ReviewCard[], now: number, limit = DAILY_REVIEW_SIZE): ReviewCard[] {
  return cards
    .filter((c) => c.dueAt <= now)
    .sort((a, b) => a.box - b.box || a.dueAt - b.dueAt || b.wrongCount - a.wrongCount)
    .slice(0, limit);
}

/** Firestore map keys must not contain dots: MAT.3.2.6 -> MAT_3_2_6. */
export function outcomeKey(code: string): string {
  return code.trim().replace(/[.\s/]+/g, '_').slice(0, 60);
}

/** Totals per kazanım for a batch of answers (only questions that name one). */
export function outcomeDeltas(answers: AnsweredPoolQuestion[]): Map<string, { code: string; categoryId: string; correct: number; total: number }> {
  const out = new Map<string, { code: string; categoryId: string; correct: number; total: number }>();
  for (const a of answers) {
    if (!a.outcomeCode) continue;
    const key = outcomeKey(a.outcomeCode);
    const d = out.get(key) ?? { code: a.outcomeCode, categoryId: a.categoryId, correct: 0, total: 0 };
    d.total += 1;
    if (a.correct) d.correct += 1;
    out.set(key, d);
  }
  return out;
}

export function outcomeMastery(stat: Pick<OutcomeStat, 'correct' | 'total'> | null | undefined): OutcomeMastery {
  if (!stat || stat.total === 0) return 'none';
  const rate = stat.correct / stat.total;
  if (stat.total < MIN_OUTCOME_ANSWERS) return rate >= 0.5 ? 'learning' : 'weak';
  if (rate >= 0.8) return 'mastered';
  if (rate >= 0.5) return 'learning';
  return 'weak';
}

export const MASTERY_LABELS: Record<OutcomeMastery, string> = {
  none: 'Henüz çalışılmadı',
  weak: 'Tekrar gerekli',
  learning: 'Öğreniyor',
  mastered: 'Öğrendi',
};

/** Weakest kazanımlar first (low rate, then more answers = more evidence). */
export function weakestOutcomes(stats: OutcomeStat[], limit = 5): OutcomeStat[] {
  return stats
    .filter((s) => outcomeMastery(s) === 'weak')
    .sort((a, b) => a.correct / a.total - b.correct / b.total || b.total - a.total)
    .slice(0, limit);
}

export interface OutcomeSummary {
  mastered: number;
  learning: number;
  weak: { code: string; text: string; pct: number; total: number }[];
  total: number;
}

/** Teacher / veli view of a student's kazanım columns (classes/{id}/progress). */
export function summarizeOutcomes(
  outcomes: Record<string, { code: string; correct: number; total: number }> | undefined,
  textByCode: Map<string, string>,
  weakLimit = 5
): OutcomeSummary {
  const stats = Object.values(outcomes ?? {}).filter((s) => s.total > 0);
  const summary: OutcomeSummary = { mastered: 0, learning: 0, weak: [], total: stats.length };
  for (const s of stats) {
    const m = outcomeMastery(s);
    if (m === 'mastered') summary.mastered++;
    else if (m === 'learning') summary.learning++;
  }
  summary.weak = stats
    .filter((s) => outcomeMastery(s) === 'weak')
    .sort((a, b) => a.correct / a.total - b.correct / b.total || b.total - a.total)
    .slice(0, weakLimit)
    .map((s) => ({ code: s.code, text: textByCode.get(s.code) ?? '', pct: Math.round((s.correct / s.total) * 100), total: s.total }));
  return summary;
}

/** code → text for every kazanım in the given categories. */
export function outcomeTexts(categories: { outcomes?: { code: string; text: string }[] }[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const c of categories) for (const o of c.outcomes ?? []) m.set(o.code, o.text);
  return m;
}
