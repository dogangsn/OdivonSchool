import { READING_TEXTS, SPEED_BANDS, WORD_RANGE, readingTextById, readingTextsForGrade } from './reading-texts';
import { countWords } from './reading-align';

describe('reading-texts', () => {
  it('has unique ids', () => {
    const ids = READING_TEXTS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers grades 1-4 with four texts each', () => {
    for (const g of [1, 2, 3, 4]) expect(readingTextsForGrade(g).length).toBe(4);
    expect(READING_TEXTS.length).toBe(16);
  });

  it('keeps each passage within its grade word range', () => {
    for (const t of READING_TEXTS) {
      const n = countWords(t.text);
      const range = WORD_RANGE[t.grade];
      expect(n).withContext(`${t.id}: ${n} kelime`).toBeGreaterThanOrEqual(range.min);
      expect(n).withContext(`${t.id}: ${n} kelime`).toBeLessThanOrEqual(range.max);
    }
  });

  it('has a title, emoji and a speed band for every text', () => {
    for (const t of READING_TEXTS) {
      expect(t.title.trim().length).toBeGreaterThan(0);
      expect(t.emoji.length).toBeGreaterThan(0);
      expect(SPEED_BANDS[t.grade].min).toBeLessThan(SPEED_BANDS[t.grade].max);
      expect(t.id).toMatch(/^[a-z0-9-]{1,40}$/);
    }
  });

  it('finds texts by id', () => {
    expect(readingTextById('minik-kedi')?.grade).toBe(1);
    expect(readingTextById('yok')).toBeUndefined();
  });
});
