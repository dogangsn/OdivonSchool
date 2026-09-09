import { Injectable, inject, signal, computed } from '@angular/core';
import { Question } from '../../models/question';
import { AnsweredQuestion, TestAttempt } from '../../models/test-attempt';
import { FirestoreService } from './firestore';

/**
 * Holds the state for a single in-progress test (question list, current index,
 * answers given so far) using signals. A new instance should be created per
 * attempt (component-level providers), not shared app-wide.
 */
@Injectable()
export class TestSessionService {
  private firestoreSvc = inject(FirestoreService);

  readonly questions = signal<Question[]>([]);
  readonly currentIndex = signal(0);
  readonly answers = signal<AnsweredQuestion[]>([]);
  readonly startedAt = signal(0);

  readonly currentQuestion = computed(() => this.questions()[this.currentIndex()] ?? null);
  readonly isLastQuestion = computed(() => this.currentIndex() === this.questions().length - 1);
  readonly correctCount = computed(() => this.answers().filter((a) => a.isCorrect).length);
  readonly progressPercent = computed(() =>
    this.questions().length ? Math.round((this.currentIndex() / this.questions().length) * 100) : 0
  );

  start(questions: Question[]) {
    this.questions.set(questions);
    this.currentIndex.set(0);
    this.answers.set([]);
    this.startedAt.set(Date.now());
  }

  /** Records the answer for the current question and returns whether it was correct. */
  answerCurrent(selectedOptionId: string, timeSpentSeconds: number): boolean {
    const q = this.currentQuestion();
    if (!q) return false;
    const isCorrect = selectedOptionId === q.correctOptionId;
    this.answers.update((list) => [
      ...list,
      { questionId: q.id, selectedOptionId, isCorrect, timeSpentSeconds },
    ]);
    return isCorrect;
  }

  next() {
    this.currentIndex.update((i) => i + 1);
  }

  async finish(userId: string, categoryId: string, level: string, subject: string) {
    const total = this.questions().length;
    const correct = this.correctCount();
    const attempt: Omit<TestAttempt, 'id'> = {
      userId,
      categoryId,
      level,
      subject,
      startedAt: this.startedAt(),
      completedAt: Date.now(),
      answers: this.answers(),
      correctCount: correct,
      totalCount: total,
      successRate: total ? Math.round((correct / total) * 100) : 0,
    };
    if (userId && userId !== 'guest') {
      await this.firestoreSvc.saveAttempt(attempt);
    }
    return attempt;
  }
}
