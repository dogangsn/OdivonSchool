import { Component, ElementRef, OnDestroy, computed, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toggleFullscreen } from '../tool-fullscreen';
import { sfx } from '../../../games/sound';

type Mode = 'countdown' | 'stopwatch';

@Component({
  selector: 'app-class-timer',
  imports: [RouterLink],
  templateUrl: './class-timer.html',
})
export class ClassTimer implements OnDestroy {
  stage = viewChild<ElementRef<HTMLElement>>('stage');
  readonly presets = [1, 2, 3, 5, 10, 15, 20, 30];

  mode = signal<Mode>('countdown');
  /** Countdown length in seconds. */
  total = signal(5 * 60);
  /** Elapsed milliseconds (both modes). */
  elapsed = signal(0);
  running = signal(false);
  finished = signal(false);

  private startedAt = 0;
  private base = 0;
  private tick: ReturnType<typeof setInterval> | null = null;

  remainingMs = computed(() => Math.max(0, this.total() * 1000 - this.elapsed()));
  shownMs = computed(() => (this.mode() === 'countdown' ? this.remainingMs() : this.elapsed()));
  display = computed(() => {
    const ms = this.shownMs();
    const secs = this.mode() === 'countdown' ? Math.ceil(ms / 1000) : Math.floor(ms / 1000);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  });
  tenths = computed(() => Math.floor((this.elapsed() % 1000) / 100));
  percent = computed(() => (this.mode() === 'countdown' ? (this.remainingMs() / (this.total() * 1000)) * 100 : 100));
  warn = computed(() => this.mode() === 'countdown' && this.running() && this.remainingMs() <= 10_000);

  setMode(m: Mode) {
    this.reset();
    this.mode.set(m);
  }

  setMinutes(min: number) {
    this.reset();
    this.total.set(Math.max(1, Math.min(180 * 60, Math.round(min * 60))));
  }

  setCustom(value: string) {
    const min = parseFloat(value.replace(',', '.'));
    if (min > 0) this.setMinutes(min);
  }

  adjust(seconds: number) {
    this.total.update((t) => Math.max(10, Math.min(180 * 60, t + seconds)));
  }

  toggle() {
    if (this.running()) this.pause();
    else this.start();
  }

  start() {
    if (this.finished()) this.reset();
    this.startedAt = Date.now();
    this.base = this.elapsed();
    this.running.set(true);
    this.tick = setInterval(() => {
      this.elapsed.set(this.base + Date.now() - this.startedAt);
      if (this.mode() === 'countdown' && this.remainingMs() <= 0) this.finish();
    }, 100);
  }

  pause() {
    this.stopTick();
    this.running.set(false);
  }

  reset() {
    this.stopTick();
    this.running.set(false);
    this.finished.set(false);
    this.elapsed.set(0);
  }

  fullscreen() {
    toggleFullscreen(this.stage()?.nativeElement);
  }

  ngOnDestroy() {
    this.stopTick();
  }

  private finish() {
    this.stopTick();
    this.running.set(false);
    this.finished.set(true);
    sfx.finish();
    setTimeout(() => sfx.finish(), 900);
  }

  private stopTick() {
    if (this.tick) clearInterval(this.tick);
    this.tick = null;
  }
}
