import {
  MIN_EACH_ANSWER,
  STATEMENTS_PER_GAME,
  STATEMENT_MS,
  TRUEFALSE_SETS,
  TrueFalseStatement,
  answerLabel,
  statementsForGame,
  trueFalsePoints,
  trueFalseSetById,
} from './truefalse-sets';

/** Deterministic pseudo-random numbers for repeatable shuffles. */
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

describe('truefalse sets', () => {
  it('has well-formed content', () => {
    expect(TRUEFALSE_SETS.length).toBeGreaterThanOrEqual(5);
    const ids = TRUEFALSE_SETS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const set of TRUEFALSE_SETS) {
      expect(set.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(set.statements.length).withContext(set.id).toBeGreaterThanOrEqual(12);
      expect(set.grades.length).withContext(set.id).toBeGreaterThan(0);
      expect(set.grades.every((g) => g >= 1 && g <= 4)).withContext(set.id).toBeTrue();
      expect(set.statements.filter((s) => s.answer).length).withContext(set.id).toBeGreaterThanOrEqual(MIN_EACH_ANSWER);
      expect(set.statements.filter((s) => !s.answer).length).withContext(set.id).toBeGreaterThanOrEqual(MIN_EACH_ANSWER);
      for (const st of set.statements) {
        expect(st.text.trim().length).withContext(set.id).toBeGreaterThan(5);
        expect(st.explanation.trim().length).withContext(st.text).toBeGreaterThan(5);
      }
      const texts = set.statements.map((s) => s.text);
      expect(new Set(texts).size).withContext(set.id).toBe(texts.length);
    }
  });

  it('finds sets by id', () => {
    expect(trueFalseSetById('saglikli-yasam')?.title).toBe('Sağlıklı Yaşam');
    expect(trueFalseSetById('yok')).toBeUndefined();
  });

  it('picks a round of distinct statements from the set', () => {
    const set = TRUEFALSE_SETS[0];
    const round = statementsForGame(set, seeded(7));
    expect(round.length).toBe(STATEMENTS_PER_GAME);
    expect(new Set(round).size).toBe(round.length);
    expect(round.every((s) => set.statements.includes(s))).toBeTrue();
  });

  it('always mixes true and false statements', () => {
    // 11 true, 3 false: a random 10 would often miss false ones.
    const statements: TrueFalseStatement[] = [
      ...Array.from({ length: 11 }, (_, i) => ({ text: `d${i}`, answer: true, explanation: '' })),
      ...Array.from({ length: 3 }, (_, i) => ({ text: `y${i}`, answer: false, explanation: '' })),
    ];
    for (let seed = 1; seed < 40; seed++) {
      const round = statementsForGame({ statements }, seeded(seed));
      expect(round.length).toBe(10);
      expect(round.filter((s) => !s.answer).length).toBe(3);
      expect(new Set(round).size).toBe(10);
    }
  });

  it('copes with small sets', () => {
    const statements: TrueFalseStatement[] = [
      { text: 'a', answer: true, explanation: '' },
      { text: 'b', answer: true, explanation: '' },
    ];
    expect(statementsForGame({ statements }, seeded(3)).length).toBe(2);
    expect(statementsForGame({ statements: [] }, seeded(3))).toEqual([]);
  });

  it('rewards fast answers and streaks, within bounds', () => {
    expect(trueFalsePoints(0, 0)).toBe(150);
    expect(trueFalsePoints(STATEMENT_MS, 0)).toBe(100);
    expect(trueFalsePoints(STATEMENT_MS / 2, 2)).toBe(145);
    expect(trueFalsePoints(STATEMENT_MS * 3, 20)).toBe(150);
    expect(trueFalsePoints(-500, 0)).toBe(150);
  });

  it('labels answers in Turkish', () => {
    expect(answerLabel(true)).toBe('Doğru');
    expect(answerLabel(false)).toBe('Yanlış');
  });
});
