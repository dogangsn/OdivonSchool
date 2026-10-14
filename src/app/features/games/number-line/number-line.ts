import { Component, HostListener, OnDestroy, computed, inject, input, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { GameResult } from '../game-result/game-result';
import { GameProgressService } from '../../../core/services/game-progress';
import { GameOutcome, GameReward } from '../../../games/game-models';
import { AssignmentRef } from '../../../models/classroom';
import {
  NumberLineProblem,
  formatLineValue,
  generateNumberLineRound,
  isPlacementCorrect,
  lineTicks,
  markerStart,
  numberLinePresetById,
  ratioToValue,
  snapValue,
  valueToRatio,
} from '../../../games/numberline-game';
import { InteractiveRound, ROUND_SIZE } from '../../../games/interactive-round';
import { locative, numberWords } from '../../../games/turkish-numbers';
import { setSoundEnabled, sfx, soundEnabled, speak, speechSupported } from '../../../games/sound';

const CORRECT_PAUSE_MS = 1100;

/** SVG geometry (viewBox units). */
const W = 640;
const PAD = 40;
const LINE_Y = 112;

type Phase = 'intro' | 'playing' | 'feedback' | 'done';

/**
 * Sayı Doğrusu: drag the marker to where a number, a result or a fraction
 * belongs. Pointer Events for mouse and touch, tap anywhere on the line to
 * jump the marker there, arrow keys / ◀ ▶ buttons for fine steps.
 */
@Component({
  selector: 'app-number-line',
  imports: [RouterLink, GameResult],
  templateUrl: './number-line.html',
  styleUrl: './number-line.scss',
})
export class NumberLine implements OnDestroy {
  private route = inject(ActivatedRoute);
  private progress = inject(GameProgressService);

  /** Set when embedded (ödev); otherwise taken from the route. */
  presetId = input<string | null>(null);
  assignment = input<AssignmentRef | null>(null);
  backLink = input('/oyunlar');
  /** Teacher preview: plays normally but nothing is saved. */
  preview = input(false);

  readonly preset = computed(() =>
    numberLinePresetById(this.presetId() ?? this.route.snapshot.paramMap.get('presetId') ?? '')
  );
  readonly canSpeak = speechSupported();
  readonly roundSize = ROUND_SIZE;
  readonly W = W;
  readonly PAD = PAD;
  readonly LINE_Y = LINE_Y;

  readonly round = new InteractiveRound<NumberLineProblem>();
  phase = signal<Phase>('intro');
  value = signal(0);
  moved = signal(false);
  dragging = signal(false);
  focused = signal(false);
  wasCorrect = signal(false);
  sound = signal(soundEnabled());
  outcome = signal<GameOutcome | null>(null);
  reward = signal<GameReward | null>(null);

  current = this.round.current;
  ticks = computed(() => {
    const preset = this.preset();
    return preset ? lineTicks(preset).map((t) => ({ ...t, x: this.xFor(t.value) })) : [];
  });
  markerX = computed(() => this.xFor(this.value()));
  targetX = computed(() => this.xFor(this.current()?.target ?? 0));
  valueLabel = computed(() => {
    const preset = this.preset();
    return preset ? formatLineValue(preset, this.value()) : '';
  });
  canMove = computed(() => this.phase() === 'playing');
  progressPercent = computed(() => ((this.round.index() + (this.phase() === 'feedback' ? 1 : 0)) / ROUND_SIZE) * 100);
  promptKicker = computed(() => {
    switch (this.current()?.kind) {
      case 'operation':
        return '🧮 İşlemin sonucunu doğruya yerleştir';
      case 'fraction':
        return '🍰 Kesri doğruya yerleştir';
      default:
        return '📍 Bu sayıyı doğruya yerleştir';
    }
  });

  private pointerId: number | null = null;
  private nextTimer: ReturnType<typeof setTimeout> | null = null;

  start() {
    const preset = this.preset();
    if (!preset) return;
    this.clearNextTimer();
    this.round.start(generateNumberLineRound(preset));
    this.outcome.set(null);
    this.reward.set(null);
    this.showProblem();
  }

  check() {
    const preset = this.preset();
    const p = this.current();
    if (!preset || !p || this.phase() !== 'playing' || !this.moved()) return;
    const ok = isPlacementCorrect(preset, p.target, this.value());
    this.wasCorrect.set(ok);
    this.dragging.set(false);
    this.pointerId = null;
    this.round.answer(ok, ok ? undefined : { prompt: `Sayı doğrusunda göster: ${p.prompt}`, correctAnswer: p.answerLabel, given: this.valueLabel() });
    this.phase.set('feedback');
    if (ok) {
      this.round.streak() > 0 && this.round.streak() % 3 === 0 ? sfx.combo() : sfx.correct();
      this.nextTimer = setTimeout(() => this.next(), CORRECT_PAUSE_MS);
    } else {
      sfx.wrong();
    }
  }

  next() {
    if (this.phase() !== 'feedback') return;
    this.clearNextTimer();
    if (!this.round.advance()) {
      void this.finish();
      return;
    }
    this.showProblem();
  }

  // ---- Pointer --------------------------------------------------------------

  onPointerDown(e: PointerEvent) {
    if (!this.canMove() || this.pointerId !== null) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const svg = e.currentTarget as SVGSVGElement;
    this.pointerId = e.pointerId;
    this.dragging.set(true);
    e.preventDefault();
    try {
      svg.setPointerCapture(e.pointerId);
    } catch {
      // Best effort.
    }
    this.moveTo(svg, e.clientX);
  }

  onPointerMove(e: PointerEvent) {
    if (e.pointerId !== this.pointerId || !this.dragging()) return;
    e.preventDefault();
    this.moveTo(e.currentTarget as SVGSVGElement, e.clientX);
  }

  onPointerUp(e: PointerEvent) {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.dragging.set(false);
  }

  private moveTo(svg: SVGSVGElement, clientX: number) {
    const preset = this.preset();
    if (!preset) return;
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * W;
    this.setValue(ratioToValue(preset, (x - PAD) / (W - 2 * PAD)));
  }

  // ---- Keyboard / buttons ----------------------------------------------------

  nudge(steps: number) {
    const preset = this.preset();
    if (!preset || !this.canMove()) return;
    this.setValue(snapValue(preset, this.value() + steps * preset.snap));
  }

  onMarkerKey(e: KeyboardEvent) {
    const preset = this.preset();
    if (!preset || !this.canMove()) return;
    const big = Math.max(1, Math.round(preset.labelEvery / preset.snap / 2));
    const map: Record<string, number> = {
      ArrowRight: 1,
      ArrowUp: 1,
      ArrowLeft: -1,
      ArrowDown: -1,
      PageUp: big,
      PageDown: -big,
    };
    if (e.key in map) {
      e.preventDefault();
      this.nudge(e.shiftKey ? map[e.key] * big : map[e.key]);
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      this.setValue(e.key === 'Home' ? preset.min : preset.max);
    }
  }

  @HostListener('window:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    if (e.key !== 'Enter') return;
    const onControl = e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement;
    if (onControl) return;
    if (this.phase() === 'playing') {
      e.preventDefault();
      this.check();
    } else if (this.phase() === 'feedback') {
      e.preventDefault();
      this.next();
    }
  }

  // ---- Misc -----------------------------------------------------------------

  readAloud() {
    const p = this.current();
    if (!p) return;
    // "3/4" is read "dörtte üç".
    const text = p.prompt.replace(/(\d+)\/(\d+)/g, (_, n, d) => `${locative(Number(d))} ${numberWords(Number(n))}`);
    speak(`${this.promptKicker().replace(/^\S+ /, '')}: ${text}`);
  }

  toggleSound() {
    const on = !this.sound();
    this.sound.set(on);
    setSoundEnabled(on);
  }

  ngOnDestroy() {
    this.clearNextTimer();
  }

  xFor(v: number): number {
    const preset = this.preset();
    if (!preset) return PAD;
    return PAD + valueToRatio(preset, v) * (W - 2 * PAD);
  }

  private setValue(v: number) {
    if (v === this.value()) return;
    this.value.set(v);
    this.moved.set(true);
    sfx.flip();
  }

  private showProblem() {
    const preset = this.preset();
    this.value.set(preset ? markerStart(preset) : 0);
    this.moved.set(false);
    this.wasCorrect.set(false);
    this.dragging.set(false);
    this.pointerId = null;
    this.phase.set('playing');
  }

  private clearNextTimer() {
    if (this.nextTimer) clearTimeout(this.nextTimer);
    this.nextTimer = null;
  }

  private async finish() {
    const preset = this.preset();
    if (!preset || this.phase() === 'done') return;
    this.phase.set('done');
    sfx.finish();
    const outcome = this.round.outcome({
      gameType: 'numberline',
      gameKey: preset.id,
      title: `Sayı Doğrusu · ${preset.title}`,
      grade: preset.grades.length === 1 ? preset.grades[0] : null,
    });
    this.outcome.set(outcome);
    this.reward.set(await this.progress.complete(outcome, this.assignment(), this.preview()));
  }
}
