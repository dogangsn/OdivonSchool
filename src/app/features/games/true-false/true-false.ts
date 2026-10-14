import { Component, HostListener, OnDestroy, computed, inject, input, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { GameResult } from '../game-result/game-result';
import { GameProgressService } from '../../../core/services/game-progress';
import { GameMistake, GameOutcome, GameReward } from '../../../games/game-models';
import { AssignmentRef } from '../../../models/classroom';
import {
  STATEMENT_MS,
  STATEMENTS_PER_GAME,
  TrueFalseSet,
  TrueFalseStatement,
  answerLabel,
  statementsForGame,
  trueFalsePoints,
  trueFalseSetById,
} from '../../../games/truefalse-sets';
import { quizStars } from '../../../games/scoring';
import { setSoundEnabled, sfx, soundEnabled, speak, speechSupported } from '../../../games/sound';

/** How long a correct answer stays on screen before the next statement. */
const CORRECT_PAUSE_MS = 900;

type Phase = 'intro' | 'playing' | 'reveal' | 'done';

/**
 * Doğru mu Yanlış mı?: a statement, two big buttons and a short timer.
 * A wrong answer (or time running out) pauses on a short teaching note.
 */
@Component({
  selector: 'app-true-false',
  imports: [RouterLink, GameResult],
  templateUrl: './true-false.html',
  styleUrl: './true-false.scss',
})
export class TrueFalse implements OnDestroy {
  private route = inject(ActivatedRoute);
  private progress = inject(GameProgressService);

  /** Set when embedded (ödev); otherwise taken from the route. */
  setId = input<string | null>(null);
  /** A teacher's own set; replaces the built-in one. */
  customSet = input<TrueFalseSet | null>(null);
  assignment = input<AssignmentRef | null>(null);
  backLink = input('/oyunlar');
  /** Teacher preview: plays normally but nothing is saved. */
  preview = input(false);

  readonly set = computed(
    () => this.customSet() ?? trueFalseSetById(this.setId() ?? this.route.snapshot.paramMap.get('setId') ?? '')
  );
  readonly canSpeak = speechSupported();
  readonly seconds = STATEMENT_MS / 1000;
  readonly roundSize = computed(() => Math.min(STATEMENTS_PER_GAME, this.set()?.statements.length ?? 0));

  phase = signal<Phase>('intro');
  statements = signal<TrueFalseStatement[]>([]);
  index = signal(0);
  picked = signal<boolean | null>(null);
  remainingMs = signal(STATEMENT_MS);
  score = signal(0);
  correct = signal(0);
  streak = signal(0);
  lastPoints = signal(0);
  sound = signal(soundEnabled());

  outcome = signal<GameOutcome | null>(null);
  reward = signal<GameReward | null>(null);

  current = computed(() => this.statements()[this.index()] ?? null);
  isLast = computed(() => this.index() >= this.statements().length - 1);
  timePercent = computed(() => (this.remainingMs() / STATEMENT_MS) * 100);
  secondsLeft = computed(() => Math.ceil(this.remainingMs() / 1000));
  wasCorrect = computed(() => {
    const s = this.current();
    return !!s && this.picked() === s.answer;
  });
  /** Wrong answers and time-outs wait for "Sonraki"; correct ones move on by themselves. */
  showLesson = computed(() => this.phase() === 'reveal' && !this.wasCorrect());
  correctLabel = computed(() => answerLabel(this.current()?.answer ?? true).toLocaleLowerCase('tr'));

  private mistakes: GameMistake[] = [];
  private maxCombo = 0;
  private startedAt = 0;
  private statementStartedAt = 0;
  private tick: ReturnType<typeof setInterval> | null = null;
  private nextTimer: ReturnType<typeof setTimeout> | null = null;

  start() {
    const set = this.set();
    if (!set) return;
    this.statements.set(statementsForGame(set));
    this.index.set(0);
    this.score.set(0);
    this.correct.set(0);
    this.streak.set(0);
    this.mistakes = [];
    this.maxCombo = 0;
    this.outcome.set(null);
    this.reward.set(null);
    this.startedAt = Date.now();
    this.showStatement();
  }

  answer(value: boolean) {
    const s = this.current();
    if (!s || this.phase() !== 'playing') return;
    this.stopTick();
    this.picked.set(value);

    if (value === s.answer) {
      const points = trueFalsePoints(Date.now() - this.statementStartedAt, this.streak());
      this.lastPoints.set(points);
      this.score.update((n) => n + points);
      this.correct.update((n) => n + 1);
      this.streak.update((n) => n + 1);
      this.maxCombo = Math.max(this.maxCombo, this.streak());
      if (this.streak() > 0 && this.streak() % 3 === 0) sfx.combo();
      else sfx.correct();
      this.phase.set('reveal');
      this.nextTimer = setTimeout(() => this.next(), CORRECT_PAUSE_MS);
    } else {
      this.recordMistake(s, value);
      sfx.wrong();
      this.phase.set('reveal');
    }
  }

  next() {
    if (this.phase() !== 'reveal') return;
    this.clearNextTimer();
    if (this.isLast()) {
      void this.finish();
      return;
    }
    this.index.update((i) => i + 1);
    this.showStatement();
  }

  readAloud() {
    const s = this.current();
    if (s) speak(s.text);
  }

  toggleSound() {
    const on = !this.sound();
    this.sound.set(on);
    setSoundEnabled(on);
  }

  @HostListener('window:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    if (this.phase() === 'playing') {
      const key = e.key.toLocaleLowerCase('tr');
      if (key === 'd' || key === '1' || e.key === 'ArrowLeft') this.answer(true);
      else if (key === 'y' || key === '2' || e.key === 'ArrowRight') this.answer(false);
    } else if (this.phase() === 'reveal' && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      this.next();
    }
  }

  ngOnDestroy() {
    this.stopTick();
    this.clearNextTimer();
  }

  private showStatement() {
    this.picked.set(null);
    this.lastPoints.set(0);
    this.remainingMs.set(STATEMENT_MS);
    this.statementStartedAt = Date.now();
    this.phase.set('playing');
    this.stopTick();
    this.tick = setInterval(() => {
      const left = STATEMENT_MS - (Date.now() - this.statementStartedAt);
      this.remainingMs.set(Math.max(0, left));
      if (left <= 0) this.timeUp();
    }, 100);
  }

  private timeUp() {
    const s = this.current();
    this.stopTick();
    if (!s || this.phase() !== 'playing') return;
    this.recordMistake(s, null);
    sfx.wrong();
    this.phase.set('reveal');
  }

  private recordMistake(s: TrueFalseStatement, given: boolean | null) {
    this.streak.set(0);
    this.lastPoints.set(0);
    this.mistakes.push({
      prompt: s.text,
      correctAnswer: answerLabel(s.answer),
      given: given === null ? null : answerLabel(given),
    });
  }

  private stopTick() {
    if (this.tick) clearInterval(this.tick);
    this.tick = null;
  }

  private clearNextTimer() {
    if (this.nextTimer) clearTimeout(this.nextTimer);
    this.nextTimer = null;
  }

  private async finish() {
    const set = this.set();
    if (!set) return;
    this.stopTick();
    this.phase.set('done');
    sfx.finish();
    const total = this.statements().length;
    const outcome: GameOutcome = {
      gameType: 'truefalse',
      gameKey: set.id,
      title: `Doğru mu Yanlış mı · ${set.title}`,
      subject: set.subject,
      grade: set.grades.length === 1 ? set.grades[0] : null,
      score: this.score(),
      stars: quizStars(this.correct(), total),
      correct: this.correct(),
      total,
      durationMs: Date.now() - this.startedAt,
      mistakes: this.mistakes,
      meta: { maxCombo: this.maxCombo },
    };
    this.outcome.set(outcome);
    this.reward.set(await this.progress.complete(outcome, this.assignment(), this.preview()));
  }
}
