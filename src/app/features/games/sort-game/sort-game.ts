import { Component, ElementRef, HostListener, OnDestroy, computed, inject, input, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { GameResult } from '../game-result/game-result';
import { GameProgressService } from '../../../core/services/game-progress';
import { GameMistake, GameOutcome, GameReward } from '../../../games/game-models';
import { AssignmentRef } from '../../../models/classroom';
import { ITEMS_PER_GAME, SortBin, SortSet, binLabel, itemsForGame, sortScore, sortSetById } from '../../../games/sort-sets';
import { sortStars } from '../../../games/scoring';
import { setSoundEnabled, sfx, soundEnabled, speak, speechSupported } from '../../../games/sound';

interface PlayItem {
  id: number;
  text: string;
  emoji?: string;
  bin: string;
  placed: boolean;
  /** Had at least one wrong drop. */
  missed: boolean;
}

interface DragState {
  id: number;
  dx: number;
  dy: number;
  over: string | null;
}

interface PointerTrack {
  id: number;
  pointerId: number;
  x0: number;
  y0: number;
  dragging: boolean;
}

/** Movement (px) before a press turns into a drag; less is a tap. */
const DRAG_THRESHOLD = 8;
/** Extra margin around a box that still counts as a drop on it. */
const DROP_SLOP = 12;

type Phase = 'intro' | 'playing' | 'done';

/**
 * Sınıflandır: put each card into the right box. Cards can be dragged
 * (Pointer Events, so mouse, pen and touch all work) or tapped and then
 * dropped by tapping a box, which also makes the game keyboard-playable.
 */
@Component({
  selector: 'app-sort-game',
  imports: [RouterLink, GameResult],
  templateUrl: './sort-game.html',
  styleUrl: './sort-game.scss',
})
export class SortGame implements OnDestroy {
  private route = inject(ActivatedRoute);
  private progress = inject(GameProgressService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Set when embedded (ödev); otherwise taken from the route. */
  setId = input<string | null>(null);
  /** A teacher's own set; replaces the built-in one. */
  customSet = input<SortSet | null>(null);
  assignment = input<AssignmentRef | null>(null);
  backLink = input('/oyunlar');
  /** Teacher preview: plays normally but nothing is saved. */
  preview = input(false);

  readonly set = computed(
    () => this.customSet() ?? sortSetById(this.setId() ?? this.route.snapshot.paramMap.get('setId') ?? '')
  );
  readonly canSpeak = speechSupported();
  readonly roundSize = computed(() => Math.min(ITEMS_PER_GAME, this.set()?.items.length ?? 0));

  phase = signal<Phase>('intro');
  items = signal<PlayItem[]>([]);
  selectedId = signal<number | null>(null);
  drag = signal<DragState | null>(null);
  shakingId = signal<number | null>(null);
  binFlash = signal<{ bin: string; ok: boolean } | null>(null);
  feedback = signal<{ text: string; ok: boolean } | null>(null);
  mistakes = signal(0);
  seconds = signal(0);
  sound = signal(soundEnabled());
  outcome = signal<GameOutcome | null>(null);
  reward = signal<GameReward | null>(null);

  pool = computed(() => this.items().filter((i) => !i.placed));
  placedCount = computed(() => this.items().filter((i) => i.placed).length);
  selected = computed(() => this.items().find((i) => i.id === this.selectedId()) ?? null);

  private mistakeLog: GameMistake[] = [];
  private startedAt = 0;
  private pointer: PointerTrack | null = null;
  private binRects: { bin: string; rect: DOMRect }[] = [];
  private suppressClickUntil = 0;
  private tick: ReturnType<typeof setInterval> | null = null;
  private timers: ReturnType<typeof setTimeout>[] = [];

  start() {
    const set = this.set();
    if (!set) return;
    this.items.set(itemsForGame(set).map((it, id) => ({ ...it, id, placed: false, missed: false })));
    this.selectedId.set(null);
    this.drag.set(null);
    this.feedback.set(null);
    this.binFlash.set(null);
    this.mistakes.set(0);
    this.seconds.set(0);
    this.mistakeLog = [];
    this.outcome.set(null);
    this.reward.set(null);
    this.phase.set('playing');
    this.startedAt = Date.now();
    this.stopTick();
    this.tick = setInterval(() => this.seconds.set(Math.floor((Date.now() - this.startedAt) / 1000)), 500);
    this.later(() => this.bringBoxesIntoView(), 80); // after the board has rendered
  }

  itemsIn(bin: SortBin): PlayItem[] {
    return this.items().filter((i) => i.placed && i.bin === bin.id);
  }

  // ---- Tap / keyboard -------------------------------------------------------

  select(item: PlayItem) {
    if (Date.now() < this.suppressClickUntil || this.phase() !== 'playing' || item.placed) return;
    if (this.selectedId() === item.id) {
      this.selectedId.set(null);
      return;
    }
    this.selectedId.set(item.id);
    sfx.flip();
    if (this.canSpeak && this.sound()) speak(item.text);
  }

  chooseBin(bin: SortBin) {
    if (Date.now() < this.suppressClickUntil || this.phase() !== 'playing') return;
    const id = this.selectedId();
    if (id === null) {
      this.feedback.set({ text: '👆 Önce bir kart seç, sonra kutusuna dokun.', ok: true });
      return;
    }
    this.place(id, bin.id);
  }

  @HostListener('window:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    if (this.phase() !== 'playing') return;
    if (e.key === 'Escape') {
      this.selectedId.set(null);
      return;
    }
    const bin = this.set()?.bins[Number(e.key) - 1];
    const id = this.selectedId();
    if (bin && id !== null) {
      e.preventDefault();
      this.place(id, bin.id);
    }
  }

  // ---- Drag (Pointer Events) ------------------------------------------------

  onPointerDown(e: PointerEvent, item: PlayItem) {
    if (this.phase() !== 'playing' || item.placed || this.pointer) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.pointer = { id: item.id, pointerId: e.pointerId, x0: e.clientX, y0: e.clientY, dragging: false };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Capture is best effort; moves still arrive while the pointer stays on the card.
    }
  }

  onPointerMove(e: PointerEvent) {
    const p = this.pointer;
    if (!p || e.pointerId !== p.pointerId) return;
    const dx = e.clientX - p.x0;
    const dy = e.clientY - p.y0;
    if (!p.dragging) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      p.dragging = true;
      this.measureBins();
      this.selectedId.set(p.id);
      this.feedback.set(null);
    }
    e.preventDefault();
    this.drag.set({ id: p.id, dx, dy, over: this.binAt(e.clientX, e.clientY) });
  }

  onPointerUp(e: PointerEvent) {
    const p = this.pointer;
    if (!p || e.pointerId !== p.pointerId) return;
    this.pointer = null;
    if (!p.dragging) return; // a tap: the click handler selects the card
    this.suppressClickUntil = Date.now() + 350;
    const over = this.binAt(e.clientX, e.clientY);
    this.drag.set(null);
    if (over) this.place(p.id, over);
  }

  onPointerCancel(e: PointerEvent) {
    const p = this.pointer;
    if (!p || e.pointerId !== p.pointerId) return;
    this.pointer = null;
    this.drag.set(null);
  }

  // ---- Shared ---------------------------------------------------------------

  toggleSound() {
    const on = !this.sound();
    this.sound.set(on);
    setSoundEnabled(on);
  }

  ngOnDestroy() {
    this.stopTick();
    this.timers.forEach(clearTimeout);
  }

  private place(itemId: number, binId: string) {
    const set = this.set();
    const item = this.items().find((i) => i.id === itemId);
    if (!set || !item || item.placed) return;
    this.selectedId.set(null);

    if (item.bin === binId) {
      this.items.update((list) => list.map((i) => (i.id === itemId ? { ...i, placed: true } : i)));
      this.flashBin(binId, true);
      this.feedback.set({ text: `✅ ${item.text} → ${binLabel(set, binId)}`, ok: true });
      sfx.correct();
      if (this.pool().length === 0) this.later(() => void this.finish(), 700);
      return;
    }

    this.mistakes.update((n) => n + 1);
    this.items.update((list) => list.map((i) => (i.id === itemId ? { ...i, missed: true } : i)));
    if (!this.mistakeLog.some((m) => m.prompt === item.text)) {
      this.mistakeLog.push({ prompt: item.text, correctAnswer: binLabel(set, item.bin), given: binLabel(set, binId) });
    }
    this.flashBin(binId, false);
    this.feedback.set({ text: `🤔 “${item.text}” bu kutuya ait değil. Tekrar dene!`, ok: false });
    sfx.wrong();
    // Restart the shake animation even when the same card misses twice in a row.
    this.shakingId.set(null);
    this.later(() => this.shakingId.set(itemId), 0);
    this.later(() => {
      if (this.shakingId() === itemId) this.shakingId.set(null);
    }, 450);
  }

  private flashBin(bin: string, ok: boolean) {
    this.binFlash.set({ bin, ok });
    this.later(() => {
      if (this.binFlash()?.bin === bin) this.binFlash.set(null);
    }, 500);
  }

  /** On short (phone) screens, scroll so the cards and the boxes are visible together while dragging. */
  private bringBoxesIntoView() {
    const root = this.host.nativeElement;
    const stage = root.querySelector('.game-stage');
    if (!stage || stage.getBoundingClientRect().bottom <= window.innerHeight) return;
    stage.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  private measureBins() {
    const els = this.host.nativeElement.querySelectorAll<HTMLElement>('[data-bin]');
    this.binRects = Array.from(els).map((el) => ({ bin: el.dataset['bin'] ?? '', rect: el.getBoundingClientRect() }));
  }

  private binAt(x: number, y: number): string | null {
    const hit = this.binRects.find(
      ({ rect }) =>
        x >= rect.left - DROP_SLOP && x <= rect.right + DROP_SLOP && y >= rect.top - DROP_SLOP && y <= rect.bottom + DROP_SLOP
    );
    return hit?.bin ?? null;
  }

  private later(fn: () => void, ms: number) {
    this.timers.push(setTimeout(fn, ms));
  }

  private stopTick() {
    if (this.tick) clearInterval(this.tick);
    this.tick = null;
  }

  private async finish() {
    const set = this.set();
    if (!set || this.phase() !== 'playing') return;
    this.stopTick();
    this.phase.set('done');
    sfx.finish();
    const durationMs = Date.now() - this.startedAt;
    const total = this.items().length;
    const mistakes = this.mistakes();
    const outcome: GameOutcome = {
      gameType: 'sort',
      gameKey: set.id,
      title: `Sınıflandır · ${set.title}`,
      subject: set.subject,
      grade: set.grades.length === 1 ? set.grades[0] : null,
      score: sortScore(total, mistakes, durationMs),
      stars: sortStars(mistakes, total),
      correct: this.items().filter((i) => !i.missed).length,
      total,
      durationMs,
      mistakes: this.mistakeLog,
    };
    this.outcome.set(outcome);
    this.reward.set(await this.progress.complete(outcome, this.assignment(), this.preview()));
  }
}
