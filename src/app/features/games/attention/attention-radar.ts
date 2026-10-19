import { Component, HostListener, OnDestroy, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { GameResult } from '../game-result/game-result';
import { GameProgressService } from '../../../core/services/game-progress';
import { GameOutcome, GameReward } from '../../../games/game-models';
import { radarPresetById, radarScore, radarStream, tallyRadar } from '../../../games/attention';
import { quizStars } from '../../../games/scoring';
import { setSoundEnabled, sfx, soundEnabled } from '../../../games/sound';

type Phase = 'intro' | 'playing' | 'done';

/** Dikkat Radarı: stimuli flash one by one; tap (or Space) only on the target. */
@Component({
  selector: 'app-attention-radar',
  imports: [RouterLink, GameResult],
  templateUrl: './attention-radar.html',
  styleUrl: './attention.scss',
})
export class AttentionRadar implements OnDestroy {
  private route = inject(ActivatedRoute);
  private progress = inject(GameProgressService);

  readonly preset = radarPresetById(this.route.snapshot.paramMap.get('presetId') ?? '');
  phase = signal<Phase>('intro');
  stream = signal<string[]>([]);
  index = signal(-1);
  /** Feedback flash for the current stimulus. */
  flash = signal<'hit' | 'false' | null>(null);
  hits = signal(0);
  falseAlarms = signal(0);
  sound = signal(soundEnabled());
  outcome = signal<GameOutcome | null>(null);
  reward = signal<GameReward | null>(null);

  current = computed<string | null>(() => this.stream()[this.index()] ?? null);
  progressPct = computed(() => ((this.index() + 1) / Math.max(1, this.stream().length)) * 100);

  private tapped: boolean[] = [];
  private reactions: number[] = [];
  private shownAt = 0;
  private startedAt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  start() {
    const p = this.preset;
    if (!p) return;
    this.stream.set(radarStream(p));
    this.tapped = [];
    this.reactions = [];
    this.hits.set(0);
    this.falseAlarms.set(0);
    this.outcome.set(null);
    this.reward.set(null);
    this.index.set(-1);
    this.phase.set('playing');
    this.startedAt = Date.now();
    this.timer = setTimeout(() => this.advance(), 700);
  }

  tap() {
    const p = this.preset;
    const i = this.index();
    if (!p || this.phase() !== 'playing' || i < 0 || this.tapped[i]) return;
    this.tapped[i] = true;
    if (this.current() === p.target) {
      this.reactions.push(Date.now() - this.shownAt);
      this.hits.update((n) => n + 1);
      this.flash.set('hit');
      sfx.correct();
    } else {
      this.falseAlarms.update((n) => n + 1);
      this.flash.set('false');
      sfx.wrong();
    }
  }

  @HostListener('window:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    if (this.phase() === 'playing' && (e.key === ' ' || e.key === 'Enter')) {
      e.preventDefault();
      this.tap();
    }
  }

  toggleSound() {
    const on = !this.sound();
    this.sound.set(on);
    setSoundEnabled(on);
  }

  ngOnDestroy() {
    if (this.timer) clearTimeout(this.timer);
  }

  private advance() {
    const p = this.preset!;
    const next = this.index() + 1;
    if (next >= this.stream().length) {
      void this.finish();
      return;
    }
    this.flash.set(null);
    this.index.set(next);
    this.shownAt = Date.now();
    this.timer = setTimeout(() => this.advance(), p.intervalMs);
  }

  private async finish() {
    const p = this.preset!;
    this.phase.set('done');
    sfx.finish();
    const stream = this.stream();
    const t = tallyRadar(stream, this.tapped, p.target);
    const avg = this.reactions.length ? this.reactions.reduce((a, b) => a + b, 0) / this.reactions.length : 0;
    const total = stream.length;
    const correct = t.hits + t.correctRejections;
    const outcome: GameOutcome = {
      gameType: 'attention',
      gameKey: `radar_${p.id}`,
      title: `Dikkat Radarı · ${p.title}`,
      subject: 'Dikkat',
      grade: p.grades.length === 1 ? p.grades[0] : null,
      score: radarScore(t, avg),
      stars: quizStars(correct, total),
      correct,
      total,
      durationMs: Date.now() - this.startedAt,
      mistakes: [
        ...(t.misses ? [{ prompt: `${p.targetName} kaçırıldı`, correctAnswer: `${t.misses} kez`, given: null }] : []),
        ...(t.falseAlarms ? [{ prompt: 'Yanlış şekle dokunuldu', correctAnswer: 'Dokunma', given: `${t.falseAlarms} kez` }] : []),
      ],
    };
    this.outcome.set(outcome);
    this.reward.set(await this.progress.complete(outcome));
  }
}
