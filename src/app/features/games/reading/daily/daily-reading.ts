import { Component, OnDestroy, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../../core/services/auth';
import { GameProgressService } from '../../../../core/services/game-progress';
import { GameMistake, GameOutcome, GameReward } from '../../../../games/game-models';
import { readingTextsForGrade } from '../../../../games/reading-texts';
import { countWords } from '../../../../games/reading-align';
import { dailyTextIndex, questionsFor, wordsPerMinute } from '../../../../games/reading-questions';
import { quizStars } from '../../../../games/scoring';
import { sfx } from '../../../../games/sound';
import { EyeGym } from '../../../tools/eye-gym/eye-gym';
import { EyePattern } from '../../../../tools/eye-paths';
import { GameResult } from '../../game-result/game-result';

type Step = 'start' | 'warmup' | 'read' | 'questions' | 'done';

const WARMUP: EyePattern[] = ['yatay', 'dikey', 'z'];

/**
 * Günün Okuması: a 10-minute daily routine for the class or one student.
 * Göz ısınması → sessiz okuma (hız ölçümü) → anlama soruları → özet.
 */
@Component({
  selector: 'app-daily-reading',
  imports: [RouterLink, EyeGym, GameResult],
  templateUrl: './daily-reading.html',
  styleUrl: './daily-reading.scss',
})
export class DailyReading implements OnDestroy {
  private auth = inject(AuthService);
  private progress = inject(GameProgressService);
  private user = toSignal(this.auth.appUser$, { initialValue: null });

  readonly warmup = WARMUP;
  readonly grades = [1, 2, 3, 4];
  grade = signal(2);
  private gradeTouched = false;

  step = signal<Step>('start');
  text = computed(() => {
    const list = readingTextsForGrade(this.grade());
    return list[dailyTextIndex(new Date(), list.length)] ?? null;
  });
  words = computed(() => countWords(this.text()?.text ?? ''));
  questions = computed(() => questionsFor(this.text()?.id ?? ''));

  readingMs = signal(0);
  reading = signal(false);
  wpm = computed(() => wordsPerMinute(this.words(), this.readingMs()));
  qIndex = signal(0);
  picked = signal<number | null>(null);
  correct = signal(0);
  outcome = signal<GameOutcome | null>(null);
  reward = signal<GameReward | null>(null);
  streak = computed(() => this.user()?.streakDays ?? 0);

  current = computed(() => this.questions()[this.qIndex()] ?? null);

  private readStart = 0;
  private tick: ReturnType<typeof setInterval> | null = null;
  private mistakes: GameMistake[] = [];
  private startedAt = 0;

  constructor() {
    effect(() => {
      const g = this.user()?.grade;
      untracked(() => {
        if (!this.gradeTouched && g && g >= 1 && g <= 4) this.grade.set(g);
      });
    });
  }

  chooseGrade(g: number) {
    this.gradeTouched = true;
    this.grade.set(g);
  }

  begin() {
    this.startedAt = Date.now();
    this.correct.set(0);
    this.qIndex.set(0);
    this.picked.set(null);
    this.mistakes = [];
    this.readingMs.set(0);
    this.outcome.set(null);
    this.reward.set(null);
    this.step.set('warmup');
  }

  warmupDone() {
    this.step.set('read');
  }

  startReading() {
    this.readStart = Date.now();
    this.reading.set(true);
    this.tick = setInterval(() => this.readingMs.set(Date.now() - this.readStart), 200);
  }

  finishReading() {
    this.stopTick();
    this.readingMs.set(Date.now() - this.readStart);
    this.reading.set(false);
    sfx.correct();
    this.step.set('questions');
  }

  answer(i: number) {
    const q = this.current();
    if (!q || this.picked() !== null) return;
    this.picked.set(i);
    if (i === q.answer) {
      this.correct.update((n) => n + 1);
      sfx.correct();
    } else {
      sfx.wrong();
      this.mistakes.push({ prompt: q.q, correctAnswer: q.options[q.answer], given: q.options[i] });
    }
  }

  nextQuestion() {
    if (this.qIndex() < this.questions().length - 1) {
      this.qIndex.update((n) => n + 1);
      this.picked.set(null);
      return;
    }
    void this.finish();
  }

  ngOnDestroy() {
    this.stopTick();
  }

  private stopTick() {
    if (this.tick) clearInterval(this.tick);
    this.tick = null;
  }

  private async finish() {
    const t = this.text();
    if (!t) return;
    this.step.set('done');
    sfx.finish();
    const total = this.questions().length;
    const outcome: GameOutcome = {
      gameType: 'reading',
      gameKey: `gunun_${t.id}`,
      title: `Günün Okuması · ${t.title}`,
      subject: 'Türkçe',
      grade: t.grade,
      score: this.correct() * 100 + Math.min(200, this.wpm()),
      stars: quizStars(this.correct(), total),
      correct: this.correct(),
      total,
      durationMs: Date.now() - this.startedAt,
      mistakes: this.mistakes,
    };
    this.outcome.set(outcome);
    this.reward.set(await this.progress.complete(outcome));
  }
}
