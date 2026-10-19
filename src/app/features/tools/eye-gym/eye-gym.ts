import { Component, ElementRef, OnDestroy, computed, input, output, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EYE_PATTERNS, EyePattern, eyePoint, peripheralCorner } from '../../../tools/eye-paths';
import { toggleFullscreen } from '../tool-fullscreen';
import { sfx } from '../../../games/sound';

/**
 * Göz jimnastiği. Standalone page under /araclar, and embedded as the warm-up
 * of Günün Okuması (`embedded` + `sequence`, emits `done`).
 */
@Component({
  selector: 'app-eye-gym',
  imports: [RouterLink],
  templateUrl: './eye-gym.html',
})
export class EyeGym implements OnDestroy {
  stage = viewChild<ElementRef<HTMLElement>>('stage');

  embedded = input(false);
  /** Patterns to run one after another (embedded warm-up). */
  sequence = input<EyePattern[]>([]);
  /** Seconds per pattern. */
  seconds = input(20);
  done = output<void>();

  readonly patterns = EYE_PATTERNS;
  pattern = signal<EyePattern>('yatay');
  speed = signal(0.5);
  duration = signal(30);
  running = signal(false);
  elapsed = signal(0);
  step = signal(0);

  point = computed(() => eyePoint(this.pattern(), this.elapsed(), this.speed()));
  corner = computed(() => peripheralCorner(this.elapsed(), this.speed()));
  hint = computed(() => EYE_PATTERNS.find((p) => p.id === this.pattern())?.hint ?? '');
  total = computed(() => (this.sequence().length ? this.seconds() : this.duration()));
  left = computed(() => Math.max(0, Math.ceil(this.total() - this.elapsed())));
  title = computed(() => EYE_PATTERNS.find((p) => p.id === this.pattern())?.title ?? '');

  private raf = 0;
  private startedAt = 0;

  ngOnInit() {
    const seq = this.sequence();
    if (seq.length) this.pattern.set(seq[0]);
  }

  choose(p: EyePattern) {
    this.stop();
    this.pattern.set(p);
    this.elapsed.set(0);
  }

  start() {
    this.stop();
    this.elapsed.set(0);
    this.running.set(true);
    this.startedAt = performance.now();
    const loop = (now: number) => {
      this.elapsed.set((now - this.startedAt) / 1000);
      if (this.elapsed() >= this.total()) {
        this.next();
        return;
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.running.set(false);
  }

  skip() {
    this.stop();
    this.done.emit();
  }

  fullscreen() {
    toggleFullscreen(this.stage()?.nativeElement);
  }

  ngOnDestroy() {
    cancelAnimationFrame(this.raf);
  }

  private next() {
    this.stop();
    const seq = this.sequence();
    if (seq.length && this.step() < seq.length - 1) {
      this.step.update((s) => s + 1);
      this.pattern.set(seq[this.step()]);
      sfx.correct();
      this.start();
      return;
    }
    sfx.finish();
    this.elapsed.set(this.total());
    if (seq.length) this.done.emit();
  }
}
