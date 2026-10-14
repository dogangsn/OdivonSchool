import { Component, ElementRef, HostListener, OnDestroy, computed, inject, input, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { GameResult } from '../game-result/game-result';
import { GameProgressService } from '../../../core/services/game-progress';
import { GameOutcome, GameReward } from '../../../games/game-models';
import { AssignmentRef } from '../../../models/classroom';
import {
  Fraction,
  FractionProblem,
  FractionShape,
  fractionPresetById,
  fractionWords,
  generateFractionRound,
  isShadeCorrect,
  mistakePrompt,
  shapeSlices,
} from '../../../games/fraction-game';
import { InteractiveRound, ROUND_SIZE } from '../../../games/interactive-round';
import { setSoundEnabled, sfx, soundEnabled, speak, speechSupported } from '../../../games/sound';

const CORRECT_PAUSE_MS = 1100;

type Phase = 'intro' | 'playing' | 'feedback' | 'done';

interface PaintStroke {
  pointerId: number;
  value: boolean;
}

/** A shape ready to draw: its slices with their shaded state. */
export interface DrawnShape {
  shape: FractionShape;
  viewBox: string;
  outline: string;
  slices: { d: string; on: boolean }[];
}

function drawn(shape: FractionShape, parts: number, shadedCount: number | boolean[]): DrawnShape {
  const g = shapeSlices(shape, parts);
  const on = (i: number) => (Array.isArray(shadedCount) ? !!shadedCount[i] : i < shadedCount);
  return { shape, viewBox: g.viewBox, outline: g.outline, slices: g.slices.map((d, i) => ({ d, on: on(i) })) };
}

/**
 * Kesir Pizzası: tap (or drag across) the slices to shade a fraction, or
 * decide which of two fractions is bigger. Slices are focusable checkboxes,
 * so Space shades, the arrow keys move between slices and Enter checks.
 */
@Component({
  selector: 'app-fraction-pizza',
  imports: [RouterLink, GameResult],
  templateUrl: './fraction-pizza.html',
  styleUrl: './fraction-pizza.scss',
})
export class FractionPizza implements OnDestroy {
  private route = inject(ActivatedRoute);
  private progress = inject(GameProgressService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Set when embedded (ödev); otherwise taken from the route. */
  presetId = input<string | null>(null);
  assignment = input<AssignmentRef | null>(null);
  backLink = input('/oyunlar');
  /** Teacher preview: plays normally but nothing is saved. */
  preview = input(false);

  readonly preset = computed(() =>
    fractionPresetById(this.presetId() ?? this.route.snapshot.paramMap.get('presetId') ?? '')
  );
  readonly canSpeak = speechSupported();
  readonly roundSize = ROUND_SIZE;

  readonly round = new InteractiveRound<FractionProblem>();
  phase = signal<Phase>('intro');
  shaded = signal<boolean[]>([]);
  picked = signal<string | null>(null);
  hint = signal(false);
  wasCorrect = signal(false);
  sound = signal(soundEnabled());
  outcome = signal<GameOutcome | null>(null);
  reward = signal<GameReward | null>(null);

  current = this.round.current;
  shade = computed(() => {
    const p = this.current();
    return p?.kind === 'shade' ? p : null;
  });
  compare = computed(() => {
    const p = this.current();
    return p?.kind === 'compare' ? p : null;
  });
  shadedCount = computed(() => this.shaded().filter(Boolean).length);
  board = computed<DrawnShape | null>(() => {
    const p = this.shade();
    return p ? drawn(p.shape, p.parts, this.shaded()) : null;
  });
  /** The right answer drawn next to the child's after a wrong shading. */
  solution = computed<DrawnShape | null>(() => {
    const p = this.shade();
    if (!p || this.phase() !== 'feedback' || this.wasCorrect()) return null;
    return drawn(p.shape, p.parts, p.answer);
  });
  showCompareShading = computed(
    () => this.preset()?.compareVisual === 'always' || this.hint() || this.phase() === 'feedback'
  );
  compareShapes = computed<[DrawnShape, DrawnShape] | null>(() => {
    const p = this.compare();
    if (!p) return null;
    const show = this.showCompareShading();
    return [drawn(p.shape, p.left.d, show ? p.left.n : 0), drawn(p.shape, p.right.d, show ? p.right.n : 0)];
  });
  progressPercent = computed(() => ((this.round.index() + (this.phase() === 'feedback' ? 1 : 0)) / ROUND_SIZE) * 100);

  private stroke: PaintStroke | null = null;
  private nextTimer: ReturnType<typeof setTimeout> | null = null;

  start() {
    const preset = this.preset();
    if (!preset) return;
    this.clearNextTimer();
    this.round.start(generateFractionRound(preset));
    this.outcome.set(null);
    this.reward.set(null);
    this.showProblem();
  }

  // ---- Answering ------------------------------------------------------------

  checkShade() {
    const p = this.shade();
    if (!p || this.phase() !== 'playing' || this.shadedCount() === 0) return;
    const n = this.shadedCount();
    this.settle(isShadeCorrect(p, n), `${p.parts} dilimden ${n} tanesi`, `${p.parts} dilimden ${p.answer} tanesi (${p.answerLabel})`);
  }

  choose(option: string) {
    const p = this.compare();
    if (!p || this.phase() !== 'playing') return;
    this.picked.set(option);
    this.settle(option === p.answer, option, p.answer);
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

  clearShading() {
    if (this.phase() !== 'playing') return;
    this.shaded.update((s) => s.map(() => false));
  }

  private settle(ok: boolean, given: string, correctAnswer: string) {
    const p = this.current()!;
    this.wasCorrect.set(ok);
    this.stroke = null;
    this.round.answer(ok, ok ? undefined : { prompt: mistakePrompt(p), correctAnswer, given });
    this.phase.set('feedback');
    if (ok) {
      this.round.streak() > 0 && this.round.streak() % 3 === 0 ? sfx.combo() : sfx.correct();
      this.nextTimer = setTimeout(() => this.next(), CORRECT_PAUSE_MS);
    } else {
      sfx.wrong();
    }
  }

  // ---- Shading: pointer (tap or paint across) -------------------------------

  onPointerDown(e: PointerEvent) {
    if (this.phase() !== 'playing' || !this.shade() || this.stroke) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const i = this.sliceIndex(e.target);
    if (i === null) return;
    e.preventDefault();
    const value = !this.shaded()[i];
    this.stroke = { pointerId: e.pointerId, value };
    this.paint(i, value);
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {
      // Best effort.
    }
  }

  onPointerMove(e: PointerEvent) {
    const s = this.stroke;
    if (!s || e.pointerId !== s.pointerId) return;
    e.preventDefault();
    const i = this.sliceIndex(document.elementFromPoint(e.clientX, e.clientY));
    if (i !== null) this.paint(i, s.value);
  }

  onPointerUp(e: PointerEvent) {
    if (this.stroke?.pointerId === e.pointerId) this.stroke = null;
  }

  // ---- Shading: keyboard ----------------------------------------------------

  onSliceKey(e: KeyboardEvent, i: number) {
    if (this.phase() !== 'playing') return;
    const count = this.shaded().length;
    if (e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      this.paint(i, !this.shaded()[i]);
    } else if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) {
      e.preventDefault();
      const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
      this.focusSlice((i + dir + count) % count);
    }
  }

  sliceLabel(i: number, total: number): string {
    return `Dilim ${i + 1} / ${total}`;
  }

  @HostListener('window:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    const onControl = e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement;
    if (this.phase() === 'playing') {
      const c = this.compare();
      if (c) {
        const idx = Number(e.key) - 1;
        if (idx >= 0 && idx < c.options.length) this.choose(c.options[idx]);
      } else if (e.key === 'Enter' && !onControl) {
        e.preventDefault();
        this.checkShade();
      }
    } else if (this.phase() === 'feedback' && e.key === 'Enter' && !onControl) {
      e.preventDefault();
      this.next();
    }
  }

  // ---- Misc -----------------------------------------------------------------

  readAloud() {
    const p = this.current();
    if (!p) return;
    if (p.kind === 'shade') {
      speak(p.prompt.replace(/\s*\(\d+\/\d+\)/, ''));
    } else {
      const words = (f: Fraction) => (this.preset()?.words ? p.options[f === p.left ? 0 : 1].replace(/\s*\(.*\)/, '') : fractionWords(f));
      speak(`Hangisi daha büyük? ${words(p.left)} mi, ${words(p.right)} mi?`);
    }
  }

  toggleSound() {
    const on = !this.sound();
    this.sound.set(on);
    setSoundEnabled(on);
  }

  ngOnDestroy() {
    this.clearNextTimer();
  }

  private paint(i: number, value: boolean) {
    if (this.shaded()[i] === value) return;
    this.shaded.update((s) => s.map((v, j) => (j === i ? value : v)));
    sfx.flip();
  }

  private sliceIndex(target: EventTarget | Element | null): number | null {
    if (!(target instanceof Element)) return null;
    const el = target.closest('[data-slice]');
    if (!el || !this.host.nativeElement.contains(el)) return null;
    const i = Number(el.getAttribute('data-slice'));
    return Number.isInteger(i) ? i : null;
  }

  private focusSlice(i: number) {
    const el = this.host.nativeElement.querySelector<SVGElement>(`.shade-board [data-slice="${i}"]`);
    el?.focus();
  }

  private showProblem() {
    const p = this.current();
    this.shaded.set(p?.kind === 'shade' ? Array.from({ length: p.parts }, () => false) : []);
    this.picked.set(null);
    this.hint.set(false);
    this.wasCorrect.set(false);
    this.stroke = null;
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
      gameType: 'fraction',
      gameKey: preset.id,
      title: `Kesir Pizzası · ${preset.title}`,
      grade: preset.grades.length === 1 ? preset.grades[0] : null,
    });
    this.outcome.set(outcome);
    this.reward.set(await this.progress.complete(outcome, this.assignment(), this.preview()));
  }
}
