import { quizItemsToQuestions, validatePairs, validateQuizItems } from './teacher-games';
import { generateJoinCode, normalizeJoinCode } from '../core/services/classroom';

describe('teacher games', () => {
  it('maps the correct index to an option id', () => {
    const [q] = quizItemsToQuestions(
      [{ prompt: '2 + 2 kaçtır?', options: ['3', '4', '5'], correctIndex: 1, explanation: '' }],
      'Matematik'
    );
    expect(q.options.map((o) => o.id)).toEqual(['a', 'b', 'c']);
    expect(q.correctOptionId).toBe('b');
  });

  it('flags incomplete quizzes', () => {
    expect(validateQuizItems([])).toContain('En az bir soru ekleyin.');
    expect(validateQuizItems([{ prompt: 'Soru', options: ['A', ''], correctIndex: 0, explanation: '' }]).length).toBeGreaterThan(0);
    expect(validateQuizItems([{ prompt: 'Soru', options: ['A', 'B'], correctIndex: 1, explanation: '' }])).toEqual([]);
  });

  it('flags duplicate or missing pair texts', () => {
    const ok = [
      { a: 'büyük', b: 'küçük' },
      { a: 'uzun', b: 'kısa' },
      { a: 'sıcak', b: 'soğuk' },
    ];
    expect(validatePairs(ok)).toEqual([]);
    expect(validatePairs([...ok, { a: 'Büyük', b: 'minik' }]).length).toBe(1);
    expect(validatePairs(ok.slice(0, 2)).length).toBe(1);
  });

  it('join codes are 6 unambiguous characters', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateJoinCode();
      expect(code).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
    }
    expect(normalizeJoinCode(' k7m-2qx ')).toBe('K7M2QX');
  });
});
