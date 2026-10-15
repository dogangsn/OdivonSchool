import {
  BOX_INTERVAL_DAYS,
  dayStartAfter,
  dueCards,
  nextCard,
  outcomeDeltas,
  outcomeKey,
  outcomeMastery,
  outcomeTexts,
  summarizeOutcomes,
  weakestOutcomes,
} from './learning';
import { AnsweredPoolQuestion, ReviewCard } from '../models/learning';

const NOW = new Date(2026, 9, 15, 14, 30).getTime();

function answer(over: Partial<AnsweredPoolQuestion> = {}): AnsweredPoolQuestion {
  return { questionId: 'q1', categoryId: 'c1', subject: 'Matematik', outcomeCode: 'MAT.3.2.6', correct: false, ...over };
}

function card(over: Partial<ReviewCard> = {}): ReviewCard {
  return { questionId: 'q1', categoryId: 'c1', subject: 'Matematik', outcomeCode: 'MAT.3.2.6', box: 1, dueAt: NOW - 1, wrongCount: 1, updatedAt: 0, ...over };
}

describe('learning', () => {
  it('schedules at the start of a local day', () => {
    const d = new Date(dayStartAfter(NOW, 1));
    expect(d.getDate()).toBe(16);
    expect(d.getHours()).toBe(0);
  });

  it('turns a wrong answer into a box-1 card due tomorrow', () => {
    const c = nextCard(null, answer(), NOW);
    expect(c.kind).toBe('save');
    if (c.kind === 'save') {
      expect(c.card.box).toBe(1);
      expect(c.card.dueAt).toBe(dayStartAfter(NOW, 1));
      expect(c.card.wrongCount).toBe(1);
    }
  });

  it('sends a known card back to box 1 on a wrong answer and counts it', () => {
    const c = nextCard(card({ box: 4, wrongCount: 2 }), answer(), NOW);
    expect(c.kind === 'save' && c.card.box).toBe(1);
    expect(c.kind === 'save' && c.card.wrongCount).toBe(3);
  });

  it('moves a due card up a box with a longer interval', () => {
    const c = nextCard(card({ box: 2 }), answer({ correct: true }), NOW);
    expect(c.kind === 'save' && c.card.box).toBe(3);
    expect(c.kind === 'save' && c.card.dueAt).toBe(dayStartAfter(NOW, BOX_INTERVAL_DAYS[2]));
  });

  it('retires a card answered right in the last box, ignores right answers without a card', () => {
    expect(nextCard(card({ box: 5 }), answer({ correct: true }), NOW).kind).toBe('retire');
    expect(nextCard(null, answer({ correct: true }), NOW).kind).toBe('none');
  });

  it('keeps the schedule when a not-yet-due card is answered right elsewhere', () => {
    expect(nextCard(card({ dueAt: NOW + 1000 }), answer({ correct: true }), NOW).kind).toBe('none');
  });

  it('picks due cards, lowest box first, up to the limit', () => {
    const cards = [
      card({ questionId: 'a', box: 3, dueAt: NOW - 10 }),
      card({ questionId: 'b', box: 1, dueAt: NOW - 5 }),
      card({ questionId: 'c', box: 1, dueAt: NOW + 10 }),
      card({ questionId: 'd', box: 1, dueAt: NOW - 50 }),
    ];
    expect(dueCards(cards, NOW).map((c) => c.questionId)).toEqual(['d', 'b', 'a']);
    expect(dueCards(cards, NOW, 1).length).toBe(1);
  });

  it('sums answers per kazanım with safe map keys', () => {
    expect(outcomeKey('MAT.3.2.6')).toBe('MAT_3_2_6');
    const d = outcomeDeltas([
      answer({ correct: true }),
      answer({ correct: false }),
      answer({ outcomeCode: null }),
      answer({ outcomeCode: 'T.2.1.1', correct: true }),
    ]);
    expect(d.get('MAT_3_2_6')).toEqual({ code: 'MAT.3.2.6', categoryId: 'c1', correct: 1, total: 2 });
    expect(d.get('T_2_1_1')?.total).toBe(1);
    expect(d.size).toBe(2);
  });

  it('labels mastery', () => {
    expect(outcomeMastery(null)).toBe('none');
    expect(outcomeMastery({ correct: 0, total: 1 })).toBe('weak');
    expect(outcomeMastery({ correct: 1, total: 1 })).toBe('learning');
    expect(outcomeMastery({ correct: 4, total: 5 })).toBe('mastered');
    expect(outcomeMastery({ correct: 3, total: 5 })).toBe('learning');
    expect(outcomeMastery({ correct: 1, total: 5 })).toBe('weak');
  });

  it('lists the weakest kazanımlar first', () => {
    const stat = (code: string, correct: number, total: number) => ({ code, categoryId: 'c', correct, total, lastAt: 0 });
    const w = weakestOutcomes([stat('a', 2, 5), stat('b', 0, 4), stat('c', 5, 5), stat('d', 1, 5)]);
    expect(w.map((s) => s.code)).toEqual(['b', 'd', 'a']);
  });

  it('summarizes a student\'s kazanımlar for the teacher', () => {
    const texts = outcomeTexts([{ outcomes: [{ code: 'A.1', text: 'Toplama yapar' }] }, {}]);
    const sum = summarizeOutcomes(
      {
        A_1: { code: 'A.1', correct: 0, total: 4 },
        B_1: { code: 'B.1', correct: 5, total: 5 },
        C_1: { code: 'C.1', correct: 1, total: 2 },
        D_1: { code: 'D.1', correct: 0, total: 0 },
      },
      texts
    );
    expect(sum.total).toBe(3);
    expect(sum.mastered).toBe(1);
    expect(sum.learning).toBe(1);
    expect(sum.weak).toEqual([{ code: 'A.1', text: 'Toplama yapar', pct: 0, total: 4 }]);
    expect(summarizeOutcomes(undefined, texts).total).toBe(0);
  });
});
