import { Component, HostListener, OnDestroy, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { GameResult } from '../game-result/game-result';
import { GameProgressService } from '../../../core/services/game-progress';
import { GameMistake, GameOutcome, GameProblem, GameReward } from '../../../games/game-models';
import { Difficulty, generateProblem, presetById } from '../../../games/math-generator';
import { comboMultiplier, speedStars } from '../../../games/scoring';
import { setSoundEnabled, sfx, soundEnabled, speak, speechSupported } from '../../../games/sound';

const GAME_MS = 60_000;
const LIVES = 3;
const POINTS_PER_CORRECT = 10;

type Phase = 'intro' | 'countdown' | 'playing' | 'learn' | 'done';

/**
 * Hız Turu: 60 seconds of generated arithmetic, 3 lives, combo multiplier.
 * A wrong answer pauses the clock and explains the solution before moving on.
 */
@Component({
  selector: 'app-speed-round',
  imports: [RouterLink, GameResult],
  templateUrl: './speed-round.html',
  styleUrl: './speed-round.scss',
})
export class SpeedRound implements OnDestroy {
  private route = inject(ActivatedRoute);
  private progress = inject(GameProgressService);

  readonly preset = presetById(this.route.snapshot.paramMap.get('presetId') ?? '');
  readonly lifeSlots = Array.from({ length: LIVES }, (_, i) => i);
  readonly canSpeak = speechSupported();

  phase = signal<Phase>('intro');
  countdown = signal(3);
  problem = signal<GameProblem | null>(null);
  picked = signal<string | null>(null);
  remainingMs = signal(GAME_MS);
  lives = signal(LIVES);
  score = signal(0);
  correct = signal(0);
  answered = signal(0);
  streak = signal(0);
  difficulty = signal<Difficulty>(1);
  sound = signal(soundEnabled());
  feedback = signal<'bump' | 'shake' | null>(null);

  outcome = signal<GameOutcome | null>(null);
  reward = signal<GameReward | null>(null);

  multiplier = computed(() => comboMultiplier(this.streak()));
  secondsLeft = computed(() => Math.ceil(this.remainingMs() / 1000));
  timePercent = computed(() => (this.remainingMs() / GAME_MS) * 100);
  dotRows = computed(() => {
    const v = this.problem()?.visual;
    return v ? Array.from({ length: v.rows * v.cols }, (_, i) => i) : [];
  });

  private mistakes: GameMistake[] = [];
  private maxCombo = 0;
  private rightInRow = 0;
  private wrongInRow = 0;
  private clockStartedAt = 0;
  private msBeforePause = 0;
  private tick: ReturnType<typeof setInterval> | null = null;
  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  private nextTimer: ReturnType<typeof setTimeout> | null = null;

  start() {
    this.resetState();
    this.phase.set('countdown');
    this.countdown.set(3);
    this.countdownTimer = setInterval(() => {
      const n = this.countdown() - 1;
      if (n > 0) {
        this.countdown.set(n);
        return;
      }
      this.clearCountdown();
      this.phase.set('playing');
      this.nextProblem();
      this.resumeClock();
    }, 800);
  }

  choose(option: string) {
    const p = this.problem();
    if (!p || this.phase() !== 'playing' || this.picked() !== null) return;
    this.picked.set(option);
    this.answered.update((n) => n + 1);

    if (option === p.answer) {
      const before = this.multiplier();
      this.correct.update((n) => n + 1);
      this.streak.update((n) => n + 1);
      this.maxCombo = Math.max(this.maxCombo, this.streak());
      this.score.update((s) => s + POINTS_PER_CORRECT * this.multiplier());
      this.multiplier() > before ? sfx.combo() : sfx.correct();
      this.feedback.set('bump');
      this.wrongInRow = 0;
      if (++this.rightInRow >= 5 && this.difficulty() < 3) {
        this.difficulty.update((d) => (d + 1) as Difficulty);
        this.rightInRow = 0;
      }
      this.nextTimer = setTimeout(() => this.nextProblem(), 280);
      return;
    }

    sfx.wrong();
    this.feedback.set('shake');
    this.lives.update((n) => n - 1);
    this.streak.set(0);
    this.rightInRow = 0;
    if (++this.wrongInRow >= 2 && this.difficulty() > 1) {
      this.difficulty.update((d) => (d - 1) as Difficulty);
      this.wrongInRow = 0;
    }
    this.mistakes.push({ prompt: p.text, correctAnswer: p.answer, given: option });
    this.pauseClock();
    this.phase.set('learn');
  }

  /** "Anladım" on the teaching panel. */
  continueAfterLearn() {
    if (this.phase() !== 'learn') return;
    if (this.lives() <= 0 || this.remainingMs() <= 0) {
      this.finish();
      return;
    }
    this.phase.set('playing');
    this.nextProblem();
    this.resumeClock();
  }

  readAloud() {
    const p = this.problem();
    if (p) speak(p.text);
  }

  toggleSound() {
    const on = !this.sound();
    this.sound.set(on);
    setSoundEnabled(on);
  }

  @HostListener('window:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    if (this.phase() === 'playing') {
      const idx = Number(e.key) - 1;
      const opts = this.problem()?.options ?? [];
      if (idx >= 0 && idx < opts.length) this.choose(opts[idx]);
    } else if (this.phase() === 'learn' && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      this.continueAfterLearn();
    }
  }

  ngOnDestroy() {
    this.stopClock();
    this.clearCountdown();
    if (this.nextTimer) clearTimeout(this.nextTimer);
  }

  private nextProblem() {
    if (!this.preset) return;
    let p = generateProblem(this.preset, this.difficulty());
    // Avoid showing the exact same card twice in a row.
    if (p.text === this.problem()?.text) p = generateProblem(this.preset, this.difficulty());
    this.problem.set(p);
    this.picked.set(null);
    this.feedback.set(null);
  }

  private resumeClock() {
    this.clockStartedAt = Date.now();
    this.stopClock();
    this.tick = setInterval(() => {
      const left = GAME_MS - this.msBeforePause - (Date.now() - this.clockStartedAt);
      this.remainingMs.set(Math.max(0, left));
      if (left <= 0 && this.phase() === 'playing') this.finish();
    }, 100);
  }

  private pauseClock() {
    this.msBeforePause += Date.now() - this.clockStartedAt;
    this.stopClock();
  }

  private stopClock() {
    if (this.tick) clearInterval(this.tick);
    this.tick = null;
  }

  private clearCountdown() {
    if (this.countdownTimer) clearInterval(this.countdownTimer);
    this.countdownTimer = null;
  }

  private async finish() {
    if (this.phase() === 'done' || !this.preset) return;
    this.stopClock();
    if (this.nextTimer) clearTimeout(this.nextTimer);
    this.phase.set('done');
    sfx.finish();

    const outcome: GameOutcome = {
      gameType: 'speed',
      gameKey: this.preset.id,
      title: `Hız Turu · ${this.preset.title}`,
      subject: 'Matematik',
      grade: this.preset.grade,
      score: this.score(),
      stars: speedStars(this.correct(), this.answered()),
      correct: this.correct(),
      total: this.answered(),
      durationMs: GAME_MS - this.remainingMs(),
      mistakes: this.mistakes,
      meta: { maxCombo: this.maxCombo },
    };
    this.outcome.set(outcome);
    this.reward.set(null);
    this.reward.set(await this.progress.complete(outcome));
  }

  private resetState() {
    this.stopClock();
    this.remainingMs.set(GAME_MS);
    this.msBeforePause = 0;
    this.lives.set(LIVES);
    this.score.set(0);
    this.correct.set(0);
    this.answered.set(0);
    this.streak.set(0);
    this.difficulty.set(1);
    this.mistakes = [];
    this.maxCombo = 0;
    this.rightInRow = 0;
    this.wrongInRow = 0;
    this.outcome.set(null);
    this.reward.set(null);
    this.problem.set(null);
  }
}
