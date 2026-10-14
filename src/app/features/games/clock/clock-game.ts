import { Component, HostListener, OnDestroy, computed, inject, input, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { GameResult } from '../game-result/game-result';
import { GameProgressService } from '../../../core/services/game-progress';
import { GameOutcome, GameReward } from '../../../games/game-models';
import { AssignmentRef } from '../../../models/classroom';
import {
  CLOCK_START,
  ClockProblem,
  ClockTime,
  addMinutes,
  angleFromVector,
  clockPresetById,
  formatDigital,
  handSnap,
  hourFromAngle,
  hourHandAngle,
  minuteFromAngle,
  minuteHandAngle,
  moveMinuteHand,
  sameTime,
  generateClockRound,
  parseDigital,
  timePhrase,
} from '../../../games/clock-game';
import { InteractiveRound, ROUND_SIZE } from '../../../games/interactive-round';
import { setSoundEnabled, sfx, soundEnabled, speak, speechSupported } from '../../../games/sound';

/** How long a right answer stays on screen before the next problem. */
const CORRECT_PAUSE_MS = 1100;

type Phase = 'intro' | 'playing' | 'feedback' | 'done';
type Hand = 'hour' | 'minute';

interface DialNumber {
  n: number;
  x: number;
  y: number;
}

interface DialTick {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  major: boolean;
}

function polar(deg: number, r: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return { x: Math.round(Math.sin(rad) * r * 100) / 100, y: Math.round(-Math.cos(rad) * r * 100) / 100 };
}

const NUMBERS: DialNumber[] = Array.from({ length: 12 }, (_, i) => ({ n: i + 1, ...polar((i + 1) * 30, 74) }));
const TICKS: DialTick[] = Array.from({ length: 60 }, (_, i) => {
  const major = i % 5 === 0;
  const a = polar(i * 6, 95);
  const b = polar(i * 6, major ? 86 : 90);
  return { x1: a.x, y1: a.y, x2: b.x, y2: b.y, major };
});

/**
 * Saat Ustası: "Saat kaç?" (read the clock, pick the time) and "Saati kur"
 * (drag the hands). The hands follow Pointer Events (mouse, pen, touch); tapping
 * the dial points the selected hand there; arrow keys move the focused hand.
 */
@Component({
  selector: 'app-clock-game',
  imports: [RouterLink, GameResult],
  templateUrl: './clock-game.html',
  styleUrl: './clock-game.scss',
})
export class ClockGame implements OnDestroy {
  private route = inject(ActivatedRoute);
  private progress = inject(GameProgressService);

  /** Set when embedded (ödev); otherwise taken from the route. */
  presetId = input<string | null>(null);
  assignment = input<AssignmentRef | null>(null);
  backLink = input('/oyunlar');
  /** Teacher preview: plays normally but nothing is saved. */
  preview = input(false);

  readonly preset = computed(() =>
    clockPresetById(this.presetId() ?? this.route.snapshot.paramMap.get('presetId') ?? '')
  );
  readonly canSpeak = speechSupported();
  readonly roundSize = ROUND_SIZE;
  readonly numbers = NUMBERS;
  readonly ticks = TICKS;

  readonly round = new InteractiveRound<ClockProblem>();
  phase = signal<Phase>('intro');
  /** The hands the child is setting (set mode). */
  time = signal<ClockTime>(CLOCK_START);
  activeHand = signal<Hand>('minute');
  focusedHand = signal<Hand | null>(null);
  dragging = signal<Hand | null>(null);
  picked = signal<string | null>(null);
  wasCorrect = signal(false);
  sound = signal(soundEnabled());
  outcome = signal<GameOutcome | null>(null);
  reward = signal<GameReward | null>(null);

  current = this.round.current;
  /** What the dial shows: the target when reading, the child's hands when setting. */
  shown = computed<ClockTime>(() => {
    const p = this.current();
    return p?.mode === 'read' ? p.target : this.time();
  });
  hourAngle = computed(() => hourHandAngle(this.shown()));
  minuteAngle = computed(() => minuteHandAngle(this.shown()));
  /** Ghost hands with the right answer after a wrong "Saati kur". */
  ghost = computed(() => {
    const p = this.current();
    if (!p || p.mode !== 'set' || this.phase() !== 'feedback' || this.wasCorrect()) return null;
    return { hour: hourHandAngle(p.target), minute: minuteHandAngle(p.target) };
  });
  canDrag = computed(() => this.phase() === 'playing' && this.current()?.mode === 'set');
  progressPercent = computed(() => ((this.round.index() + (this.phase() === 'feedback' ? 1 : 0)) / ROUND_SIZE) * 100);
  setDigital = computed(() => formatDigital(this.time()));

  private pointerId: number | null = null;
  private nextTimer: ReturnType<typeof setTimeout> | null = null;

  start() {
    const preset = this.preset();
    if (!preset) return;
    this.clearNextTimer();
    this.round.start(generateClockRound(preset));
    this.outcome.set(null);
    this.reward.set(null);
    this.showProblem();
  }

  // ---- Answering ------------------------------------------------------------

  choose(option: string) {
    const p = this.current();
    if (!p || p.mode !== 'read' || this.phase() !== 'playing') return;
    this.picked.set(option);
    this.settle(option === p.digital, option);
  }

  check() {
    const p = this.current();
    if (!p || p.mode !== 'set' || this.phase() !== 'playing') return;
    this.picked.set(this.setDigital());
    this.settle(sameTime(this.time(), p.target), this.setDigital());
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

  private settle(ok: boolean, given: string) {
    const p = this.current()!;
    this.wasCorrect.set(ok);
    this.dragging.set(null);
    this.pointerId = null;
    this.round.answer(
      ok,
      ok
        ? undefined
        : {
            prompt: p.mode === 'read' ? 'Saat kaç?' : `Saati kur: ${this.capitalized(p.phrase)}`,
            correctAnswer: `${p.digital} (${p.phrase})`,
            given,
          }
    );
    this.phase.set('feedback');
    if (ok) {
      this.round.streak() > 0 && this.round.streak() % 3 === 0 ? sfx.combo() : sfx.correct();
      this.nextTimer = setTimeout(() => this.next(), CORRECT_PAUSE_MS);
    } else {
      sfx.wrong();
    }
  }

  // ---- Hands: pointer -------------------------------------------------------

  selectHand(hand: Hand) {
    this.activeHand.set(hand);
  }

  onDialPointerDown(e: PointerEvent) {
    if (!this.canDrag() || this.pointerId !== null) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const svg = e.currentTarget as SVGSVGElement;
    const { deg, dist } = this.dialPoint(svg, e);
    const grabbed = this.handNear(deg, dist);
    const hand = grabbed ?? this.activeHand();
    this.activeHand.set(hand);
    this.dragging.set(hand);
    this.pointerId = e.pointerId;
    e.preventDefault();
    try {
      svg.setPointerCapture(e.pointerId);
    } catch {
      // Best effort: moves still arrive while the pointer stays over the dial.
    }
    // A press on the dial away from the hands points the selected hand there straight away.
    if (!grabbed) this.setHand(hand, deg);
  }

  onDialPointerMove(e: PointerEvent) {
    const hand = this.dragging();
    if (!hand || e.pointerId !== this.pointerId) return;
    e.preventDefault();
    this.pointHandAt(hand, e);
  }

  onDialPointerUp(e: PointerEvent) {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.dragging.set(null);
  }

  private pointHandAt(hand: Hand, e: PointerEvent) {
    const svg = e.currentTarget as SVGSVGElement;
    this.setHand(hand, this.dialPoint(svg, e).deg);
  }

  /** Angle (from 12, clockwise) and distance (in dial units, radius 110) of the pointer. */
  private dialPoint(svg: Element, e: PointerEvent): { deg: number; dist: number } {
    const rect = svg.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    return { deg: angleFromVector(dx, dy), dist: (Math.hypot(dx, dy) / (rect.width / 2)) * 110 };
  }

  /** The hand under the pointer, if any: the short hour hand wins close to the centre. */
  private handNear(deg: number, dist: number): Hand | null {
    const off = (a: number) => Math.abs(((deg - a + 540) % 360) - 180);
    const nearHour = off(this.hourAngle()) <= 22 && dist <= 66;
    const nearMinute = off(this.minuteAngle()) <= 16 && dist <= 96;
    if (nearHour && nearMinute) return dist < 58 ? 'hour' : 'minute';
    return nearHour ? 'hour' : nearMinute ? 'minute' : null;
  }

  private setHand(hand: Hand, deg: number) {
    const preset = this.preset();
    if (!preset) return;
    const t = this.time();
    let next: ClockTime;
    if (hand === 'minute') {
      next = moveMinuteHand(t, minuteFromAngle(deg, handSnap(preset)));
    } else {
      next = { hour: hourFromAngle(deg, t.minute), minute: t.minute };
    }
    if (!sameTime(next, t)) {
      this.time.set(next);
      if (hand === 'minute' && next.minute % 5 === 0) sfx.flip();
    }
  }

  // ---- Hands: keyboard and buttons -------------------------------------------

  nudge(hand: Hand, dir: 1 | -1) {
    const preset = this.preset();
    if (!preset || !this.canDrag()) return;
    this.activeHand.set(hand);
    this.time.update((t) => addMinutes(t, hand === 'minute' ? dir * handSnap(preset) : dir * 60));
  }

  onHandKey(e: KeyboardEvent, hand: Hand) {
    if (!this.canDrag()) return;
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
    if (dir) {
      e.preventDefault();
      e.stopPropagation();
      this.nudge(hand, dir);
    }
  }

  handValueText(hand: Hand): string {
    const t = this.time();
    return hand === 'hour' ? `Akrep: ${t.hour}` : `Yelkovan: ${t.minute} dakika`;
  }

  @HostListener('window:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    const p = this.current();
    if (!p) return;
    const onControl = e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement;
    if (this.phase() === 'playing') {
      if (p.mode === 'read') {
        const idx = Number(e.key) - 1;
        if (idx >= 0 && idx < p.options.length) this.choose(p.options[idx]);
      } else if (e.key === 'Enter' && !onControl) {
        e.preventDefault();
        this.check();
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
    speak(p.mode === 'read' ? 'Saat kaç?' : `Saati kur: ${p.phrase}`);
  }

  toggleSound() {
    const on = !this.sound();
    this.sound.set(on);
    setSoundEnabled(on);
  }

  capitalized(text: string): string {
    return text.charAt(0).toLocaleUpperCase('tr') + text.slice(1);
  }

  /** "03:30" → "Saat üç buçuk", shown under each choice. */
  optionPhrase(digital: string): string {
    const t = parseDigital(digital);
    return t ? this.capitalized(timePhrase(t)) : '';
  }

  ngOnDestroy() {
    this.clearNextTimer();
  }

  private showProblem() {
    this.time.set(CLOCK_START);
    this.activeHand.set('minute');
    this.picked.set(null);
    this.wasCorrect.set(false);
    this.dragging.set(null);
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
      gameType: 'clock',
      gameKey: preset.id,
      title: `Saat Ustası · ${preset.title}`,
      grade: preset.grades.length === 1 ? preset.grades[0] : null,
    });
    this.outcome.set(outcome);
    this.reward.set(await this.progress.complete(outcome, this.assignment(), this.preview()));
  }
}
