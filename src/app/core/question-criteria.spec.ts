import {
  categoriesForGrade,
  findDuplicate,
  passesPool,
  poolCriteria,
  scoreExam,
  shuffledOrder,
  similarity,
  toPoolQuestion,
  validateQuestion,
} from './question-criteria';
import { TestCategory } from '../models/test-category';
import { TeacherQuestion, TeacherQuestionDraft } from '../models/teacher-question';

const CAT: TestCategory = {
  id: 'ilkokul-3-matematik-t2',
  level: 'ilkokul',
  subject: 'Matematik',
  topic: 'Sayılar',
  order: 1,
  grades: [3],
  outcomes: [
    { code: 'MAT.3.1.1', text: 'Üç basamaklı sayıları okur.' },
    { code: 'MAT.3.1.2', text: 'Sayıları karşılaştırır.' },
  ],
};

function draft(over: Partial<TeacherQuestionDraft> = {}): TeacherQuestionDraft {
  return {
    grade: 3,
    level: 'ilkokul',
    subject: 'Matematik',
    categoryId: CAT.id,
    topic: CAT.topic,
    outcomeCode: 'MAT.3.1.1',
    outcomeText: 'Üç basamaklı sayıları okur.',
    prompt: '345 sayısının okunuşu hangisidir?',
    options: ['Üç yüz kırk beş', 'Üç yüz elli dört', 'Dört yüz otuz beş', 'Üç yüz kırk'],
    correctIndex: 0,
    explanation: 'Yüzler basamağında 3, onlarda 4, birlerde 5 vardır: üç yüz kırk beş.',
    difficulty: 2,
    ...over,
  };
}

describe('question criteria', () => {
  it('accepts a complete question for the bank and the pool', () => {
    expect(validateQuestion(draft())).toEqual([]);
    expect(passesPool(poolCriteria(draft(), CAT, null))).toBeTrue();
  });

  it('rejects empty or repeated options', () => {
    expect(validateQuestion(draft({ options: ['a', 'b', '', 'd'] })).length).toBe(1);
    expect(validateQuestion(draft({ options: ['Beş', 'beş.', 'Altı', 'Yedi'] }))).toContain('İki şık aynı olamaz.');
  });

  it('needs a kazanım of the chosen konu for the pool', () => {
    const results = poolCriteria(draft({ outcomeCode: null }), CAT, null);
    expect(results.find((r) => r.id === 'outcome')!.ok).toBeFalse();
    const wrongCode = poolCriteria(draft({ outcomeCode: 'TUR.3.1.1' }), CAT, null);
    expect(wrongCode.find((r) => r.id === 'outcome')!.ok).toBeFalse();
    const general = poolCriteria(draft({ outcomeCode: null }), { ...CAT, outcomes: [] }, null);
    expect(general.find((r) => r.id === 'outcome')!.ok).toBeTrue();
  });

  it('needs an explanation for the pool but not for the bank', () => {
    const q = draft({ explanation: '' });
    expect(validateQuestion(q)).toEqual([]);
    expect(passesPool(poolCriteria(q, CAT, null))).toBeFalse();
  });

  it('finds near-identical questions', () => {
    const pool = [{ prompt: '345 sayısının okunuşu hangisidir' }, { prompt: 'Hangi sayı en büyüktür?' }];
    expect(findDuplicate('345 sayısının okunuşu hangisidir?', pool)).toBe(pool[0]);
    expect(findDuplicate('Bir haftada kaç gün vardır?', pool)).toBeNull();
    expect(similarity('a b c', 'x y z')).toBe(0);
  });

  it('makes a draft pool copy with a-d options', () => {
    const q: TeacherQuestion = {
      ...draft({ correctIndex: 2 }),
      id: 'abc',
      ownerId: 'u1',
      ownerName: 'Ayşe Öğretmen',
      poolSubmittedAt: null,
      createdAt: 1,
      updatedAt: 1,
    };
    const p = toPoolQuestion(q, 100);
    expect(p.reviewStatus).toBe('draft');
    expect(p.source).toBe('teacher');
    expect(p.correctOptionId).toBe('c');
    expect(p.options.map((o) => o.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(p.authorId).toBe('u1');
    expect(p.outcomeCode).toBe('MAT.3.1.1');
  });
});

describe('exam scoring', () => {
  it('counts doğru, yanlış and boş', () => {
    const s = scoreExam([0, 1, -1, 3], { correct: [0, 2, 1, 3] });
    expect(s.correct).toBe(2);
    expect(s.wrong).toBe(1);
    expect(s.blank).toBe(1);
    expect(s.points).toBe(50);
    expect(s.marks).toEqual([true, false, null, true]);
  });

  it('shuffles the same way for the same student', () => {
    const a = shuffledOrder(10, 'u1-e1');
    expect(shuffledOrder(10, 'u1-e1')).toEqual(a);
    expect([...a].sort((x, y) => x - y)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('lists MEB temaları of the grade first', () => {
    const legacy: TestCategory = { id: 'x', level: 'ilkokul', subject: 'Matematik', topic: 'Genel', order: 1, grades: [1, 2, 3, 4] };
    const other: TestCategory = { ...CAT, id: 'y', grades: [4] };
    expect(categoriesForGrade([legacy, CAT, other], 3).map((c) => c.id)).toEqual([CAT.id, 'x']);
  });
});
