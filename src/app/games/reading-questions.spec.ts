import { READING_TEXTS } from './reading-texts';
import { READING_QUESTIONS, dailyTextIndex, wordsPerMinute } from './reading-questions';

describe('Günün Okuması', () => {
  it('has three questions with a valid answer for every passage', () => {
    for (const t of READING_TEXTS) {
      const qs = READING_QUESTIONS[t.id];
      expect(qs?.length).withContext(t.id).toBe(3);
      for (const q of qs) {
        expect(q.answer).toBeGreaterThanOrEqual(0);
        expect(q.answer).toBeLessThan(q.options.length);
      }
    }
  });

  it('rotates the passage day by day', () => {
    const a = dailyTextIndex(new Date(2026, 9, 19), 4);
    const b = dailyTextIndex(new Date(2026, 9, 20), 4);
    expect((a + 1) % 4).toBe(b);
  });

  it('computes words per minute', () => {
    expect(wordsPerMinute(60, 60_000)).toBe(60);
    expect(wordsPerMinute(30, 0)).toBe(0);
  });
});
