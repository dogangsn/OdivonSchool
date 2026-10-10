import { TestBed } from '@angular/core/testing';
import { TestSessionService } from './test-session';
import { FirestoreService } from './firestore';
import { Question } from '../../models/question';

function makeQuestion(id: string, correctOptionId: string): Question {
  return {
    id,
    categoryId: 'cat',
    level: 'ilkokul',
    subject: 'Matematik',
    prompt: `Soru ${id}`,
    options: [
      { id: 'a', text: 'A' },
      { id: 'b', text: 'B' },
    ],
    correctOptionId,
    explanation: '',
    difficulty: 1,
    source: 'manual',
    reviewStatus: 'approved',
    createdAt: 0,
    usageCount: 0,
    correctCount: 0,
  };
}

describe('TestSessionService', () => {
  let session: TestSessionService;
  let saveAttempt: jasmine.Spy;

  beforeEach(() => {
    saveAttempt = jasmine.createSpy('saveAttempt').and.resolveTo(undefined);
    TestBed.configureTestingModule({
      providers: [TestSessionService, { provide: FirestoreService, useValue: { saveAttempt } }],
    });
    session = TestBed.inject(TestSessionService);
    session.start([makeQuestion('1', 'a'), makeQuestion('2', 'b'), makeQuestion('3', 'a')]);
  });

  it('scores correct, wrong and skipped answers', async () => {
    expect(session.answerCurrent('a', 5)).toBeTrue();
    session.next();
    expect(session.answerCurrent('a', 5)).toBeFalse();
    session.next();
    expect(session.answerCurrent(null, 5)).toBeFalse();

    const attempt = await session.finish('user-1', 'cat', 'ilkokul', 'Matematik');
    expect(attempt.correctCount).toBe(1);
    expect(attempt.totalCount).toBe(3);
    expect(attempt.successRate).toBe(33);
    expect(attempt.answers[2].selectedOptionId).toBeNull();
    expect(saveAttempt).toHaveBeenCalledTimes(1);
  });

  it('does not save guest attempts to Firestore', async () => {
    await session.finish('guest', 'cat', 'ilkokul', 'Matematik');
    expect(saveAttempt).not.toHaveBeenCalled();
  });
});
