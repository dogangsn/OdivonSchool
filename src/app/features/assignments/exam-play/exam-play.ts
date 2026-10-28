import { Component, OnDestroy, OnInit, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom, take } from 'rxjs';
import { AuthService } from '../../../core/services/auth';
import { QuestionBankService } from '../../../core/services/question-bank';
import { GameProgressService } from '../../../core/services/game-progress';
import { ClassroomService } from '../../../core/services/classroom';
import { LearningService } from '../../../core/services/learning';
import { Assignment, AssignmentRef } from '../../../models/classroom';
import { AppUser } from '../../../models/user';
import { ExamAnswerSheet, ExamKey, OPTION_LETTERS } from '../../../models/teacher-question';
import { ExamScore, scoreExam, shuffledOrder } from '../../../core/question-criteria';
import { GameMistake, GameOutcome } from '../../../games/game-models';
import { quizStars } from '../../../games/scoring';
import { AnsweredPoolQuestion } from '../../../models/learning';

type Phase = 'loading' | 'intro' | 'exam' | 'sending' | 'result' | 'error';

interface SavedProgress {
  startedAt: number;
  answers: number[];
}

/** A student's exam: intro, one question at a time, hand in once, result. */
@Component({
  selector: 'app-exam-play',
  imports: [RouterLink],
  templateUrl: './exam-play.html',
  styleUrl: './exam-play.scss',
})
export class ExamPlay implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private bank = inject(QuestionBankService);
  private progress = inject(GameProgressService);
  private classroom = inject(ClassroomService);
  private learning = inject(LearningService);

  assignment = input.required<Assignment>();
  ref = input.required<AssignmentRef>();

  readonly letters = OPTION_LETTERS;

  phase = signal<Phase>('loading');
  error = signal<string | null>(null);
  current = signal(0); // position in `order`
  answers = signal<number[]>([]);
  order = signal<number[]>([]);
  remainingMs = signal<number | null>(null);
  confirmOpen = signal(false);

  sheet = signal<ExamAnswerSheet | null>(null);
  key = signal<ExamKey | null>(null);
  score = signal<ExamScore | null>(null);

  private user: AppUser | null = null;
  private startedAt = 0;
  private tick: ReturnType<typeof setInterval> | null = null;

  questions = computed(() => this.assignment().examQuestions ?? []);
  total = computed(() => this.questions().length);
  /** Index into `questions` of the question on screen. */
  qIndex = computed(() => this.order()[this.current()] ?? 0);
  question = computed(() => this.questions()[this.qIndex()]);
  answeredCount = computed(() => this.answers().filter((a) => a >= 0).length);
  blankCount = computed(() => this.total() - this.answeredCount());
  timeLimitMs = computed(() => (this.assignment().timeLimitMin ?? 0) * 60_000);
  overdue = computed(() => {
    const due = this.assignment().dueAt;
    return !!due && Date.now() > due;
  });
  clock = computed(() => {
    const ms = this.remainingMs();
    if (ms === null) return '';
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  });

  private get storageKey() {
    return `odv-sinav-${this.ref().classId}-${this.ref().assignmentId}`;
  }

  async ngOnInit() {
    try {
      this.user = await firstValueFrom(this.auth.appUser$.pipe(take(1)));
      if (!this.user) throw new Error('Oturum bulunamadı.');
      const n = this.total();
      this.order.set(
        this.assignment().shuffle ? shuffledOrder(n, `${this.user.uid}-${this.assignment().id}`) : [...Array(n).keys()]
      );
      const sheet = await this.bank.myAnswerSheet(this.ref().classId, this.ref().assignmentId, this.user.uid);
      if (sheet) {
        await this.showResult(sheet, false);
        return;
      }
      const saved = this.readSaved();
      if (saved && saved.answers.length === n) {
        this.answers.set(saved.answers);
        this.startedAt = saved.startedAt;
        this.phase.set('exam');
        this.startClock();
      } else {
        this.answers.set(Array(n).fill(-1));
        this.phase.set('intro');
      }
    } catch (err: any) {
      this.error.set(err?.message ?? String(err));
      this.phase.set('error');
    }
  }

  ngOnDestroy() {
    this.stopClock();
  }

  start() {
    this.startedAt = Date.now();
    this.current.set(0);
    this.persist();
    this.phase.set('exam');
    this.startClock();
  }

  choose(option: number) {
    const i = this.qIndex();
    this.answers.update((list) => list.map((a, j) => (j === i ? (a === option ? -1 : option) : a)));
    this.persist();
  }

  go(pos: number) {
    if (pos >= 0 && pos < this.total()) this.current.set(pos);
  }

  answerAt(pos: number): number {
    return this.answers()[this.order()[pos]] ?? -1;
  }

  async handIn() {
    if (!this.user || this.phase() !== 'exam') return;
    this.confirmOpen.set(false);
    this.stopClock();
    this.phase.set('sending');
    const now = Date.now();
    const sheet: ExamAnswerSheet = {
      uid: this.user.uid,
      displayName: (this.user.displayName || 'Öğrenci').slice(0, 80),
      answers: this.answers(),
      startedAt: this.startedAt || now,
      submittedAt: now,
      durationMs: Math.max(0, now - (this.startedAt || now)),
    };
    try {
      await this.bank.handIn(this.ref().classId, this.ref().assignmentId, sheet);
      this.clearSaved();
      await this.showResult(sheet, true);
    } catch (err: any) {
      // Keep the answers on screen so the student can try again.
      this.error.set(`Cevapların gönderilemedi: ${err?.message ?? err}. İnternet bağlantını kontrol edip tekrar dene.`);
      this.phase.set('exam');
      this.startClock();
    }
  }

  private async showResult(sheet: ExamAnswerSheet, fresh: boolean) {
    this.sheet.set(sheet);
    const key = await this.bank.examKey(this.ref().classId, this.ref().assignmentId).catch(() => null);
    this.key.set(key);
    if (key) {
      const score = scoreExam(sheet.answers, key);
      this.score.set(score);
      const outcome = this.outcome(sheet, key, score);
      if (fresh) {
        await this.progress.complete(outcome, this.ref());
        void this.learning.record(this.user!, this.learningAnswers(score));
      } else {
        // Handed in earlier but the result may not have reached the teacher's list.
        const sub = await firstValueFrom(this.classroom.mySubmission(this.ref(), sheet.uid).pipe(take(1)));
        if (!sub) await this.classroom.submit(this.ref(), outcome).catch(() => undefined);
      }
    }
    this.phase.set('result');
  }

  private outcome(sheet: ExamAnswerSheet, key: ExamKey, score: ExamScore): GameOutcome {
    const a = this.assignment();
    const mistakes: GameMistake[] = [];
    score.marks.forEach((m, i) => {
      if (m === true) return;
      const q = this.questions()[i];
      const given = sheet.answers[i];
      mistakes.push({
        prompt: q.prompt.slice(0, 200),
        correctAnswer: q.options[key.correct[i]] ?? '',
        given: given >= 0 ? (q.options[given] ?? null) : null,
      });
    });
    return {
      gameType: 'quiz',
      gameKey: `sinav-${a.id}`,
      title: `Sınav · ${a.title}`,
      subject: a.subject,
      grade: null,
      score: score.points,
      stars: quizStars(score.correct, score.total),
      correct: score.correct,
      total: score.total,
      durationMs: sheet.durationMs,
      mistakes,
    };
  }

  private learningAnswers(score: ExamScore): AnsweredPoolQuestion[] {
    return this.questions()
      .map((q, i) => ({ q, mark: score.marks[i] }))
      .filter(({ q }) => !!q.categoryId && (!!q.poolId || !!q.outcomeCode))
      .map(({ q, mark }, i) => ({
        questionId: q.poolId ?? `sinav-${this.assignment().id}-${i}`,
        categoryId: q.categoryId!,
        subject: q.subject,
        outcomeCode: q.outcomeCode,
        correct: mark === true,
        noCard: !q.poolId,
      }));
  }

  // --- timer ---
  private startClock() {
    const limit = this.timeLimitMs();
    if (!limit) {
      this.remainingMs.set(null);
      return;
    }
    const update = () => {
      const left = limit - (Date.now() - this.startedAt);
      this.remainingMs.set(left);
      if (left <= 0) void this.handIn();
    };
    update();
    this.stopClock();
    this.tick = setInterval(update, 1000);
  }

  private stopClock() {
    if (this.tick) clearInterval(this.tick);
    this.tick = null;
  }

  // --- local draft (survives a reload) ---
  private persist() {
    try {
      const data: SavedProgress = { startedAt: this.startedAt, answers: this.answers() };
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch {
      // Private mode: the exam still works, a reload just starts over.
    }
  }

  private readSaved(): SavedProgress | null {
    try {
      const raw = localStorage.getItem(this.storageKey);
      return raw ? (JSON.parse(raw) as SavedProgress) : null;
    } catch {
      return null;
    }
  }

  private clearSaved() {
    try {
      localStorage.removeItem(this.storageKey);
    } catch {
      // ignore
    }
  }

  markFor(i: number): boolean | null {
    return this.score()?.marks[i] ?? null;
  }
}
