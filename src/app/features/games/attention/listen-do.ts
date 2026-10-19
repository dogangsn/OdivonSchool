import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { GameResult } from '../game-result/game-result';
import { GameProgressService } from '../../../core/services/game-progress';
import { GameMistake, GameOutcome, GameReward } from '../../../games/game-models';
import {
  ShapeChip,
  commandLength,
  commandText,
  listenBoard,
  listenPresetById,
  listenSequence,
} from '../../../games/attention';
import { quizStars } from '../../../games/scoring';
import { setSoundEnabled, sfx, soundEnabled, speak, speechSupported } from '../../../games/sound';

type Phase = 'intro' | 'listen' | 'act' | 'feedback' | 'done';

/** Dinle ve Uygula: hear "önce mavi kareye, sonra..." and tap the shapes in order. */
@Component({
  selector: 'app-listen-do',
  imports: [RouterLink, GameResult],
  templateUrl: './listen-do.html',
  styleUrl: './attention.scss',
})
export class ListenDo implements OnDestroy {
  private route = inject(ActivatedRoute);
  private progress = inject(GameProgressService);

  readonly preset = listenPresetById(this.route.snapshot.paramMap.get('presetId') ?? '');
  readonly canSpeak = speechSupported();

  phase = signal<Phase>('intro');
  board = signal<ShapeChip[]>([]);
  round = signal(0);
  sequence = signal<string[]>([]);
  taps = signal<string[]>([]);
  lastOk = signal(false);
  correct = signal(0);
  sound = signal(soundEnabled());
  outcome = signal<GameOutcome | null>(null);
  reward = signal<GameReward | null>(null);

  command = computed(() => commandText(this.sequence()));
  /** Without speech the command is shown as text, then hidden. */
  showText = signal(false);

  private mistakes: GameMistake[] = [];
  private score = 0;
  private startedAt = 0;
  private timers: ReturnType<typeof setTimeout>[] = [];

  start() {
    const p = this.preset;
    if (!p) return;
    this.board.set(listenBoard(p.chips));
    this.round.set(0);
    this.correct.set(0);
    this.mistakes = [];
    this.score = 0;
    this.outcome.set(null);
    this.reward.set(null);
    this.startedAt = Date.now();
    this.newRound();
  }

  replayCommand() {
    if (this.canSpeak) speak(this.command());
    else this.flashText();
  }

  ready() {
    this.showText.set(false);
    this.phase.set('act');
  }

  tapChip(id: string) {
    if (this.phase() !== 'act') return;
    const seq = this.sequence();
    const taps = [...this.taps(), id];
    this.taps.set(taps);
    const i = taps.length - 1;
    if (seq[i] !== id) {
      sfx.wrong();
      this.mistakes.push({ prompt: this.command(), correctAnswer: seq.join(' → '), given: taps.join(' → ') });
      this.endRound(false);
      return;
    }
    sfx.correct();
    if (taps.length === seq.length) this.endRound(true);
  }

  isTapped(id: string) {
    return this.taps().includes(id);
  }

  toggleSound() {
    const on = !this.sound();
    this.sound.set(on);
    setSoundEnabled(on);
  }

  ngOnDestroy() {
    this.timers.forEach(clearTimeout);
    try {
      window.speechSynthesis?.cancel();
    } catch {
      // ignore
    }
  }

  next() {
    const p = this.preset!;
    if (this.round() + 1 >= p.rounds) {
      void this.finish();
      return;
    }
    this.round.update((r) => r + 1);
    this.newRound();
  }

  private newRound() {
    const p = this.preset!;
    this.sequence.set(listenSequence(this.board(), commandLength(p, this.round())));
    this.taps.set([]);
    this.phase.set('listen');
    this.timers.push(setTimeout(() => this.replayCommand(), 400));
  }

  private flashText() {
    this.showText.set(true);
    const ms = 1500 + this.sequence().length * 1100;
    this.timers.push(setTimeout(() => this.showText.set(false), ms));
  }

  private endRound(ok: boolean) {
    this.lastOk.set(ok);
    if (ok) {
      this.correct.update((n) => n + 1);
      this.score += 100 * this.sequence().length;
    }
    this.phase.set('feedback');
  }

  private async finish() {
    const p = this.preset!;
    this.phase.set('done');
    sfx.finish();
    const outcome: GameOutcome = {
      gameType: 'attention',
      gameKey: `dinle_${p.id}`,
      title: `Dinle ve Uygula · ${p.title}`,
      subject: 'Dikkat',
      grade: p.grades.length === 1 ? p.grades[0] : null,
      score: this.score,
      stars: quizStars(this.correct(), p.rounds),
      correct: this.correct(),
      total: p.rounds,
      durationMs: Date.now() - this.startedAt,
      mistakes: this.mistakes,
    };
    this.outcome.set(outcome);
    this.reward.set(await this.progress.complete(outcome));
  }
}
