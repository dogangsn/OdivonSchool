import { Component, ElementRef, computed, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ClassListEditor } from '../class-list-editor/class-list-editor';
import { loadClassList } from '../../../tools/class-list';
import { toggleFullscreen } from '../tool-fullscreen';
import { sfx } from '../../../games/sound';

const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#0ea5e9', '#a855f7', '#ef4444', '#14b8a6'];
const SPIN_MS = 4200;

interface Segment {
  name: string;
  path: string;
  color: string;
  labelX: number;
  labelY: number;
  labelAngle: number;
}

@Component({
  selector: 'app-lucky-wheel',
  imports: [RouterLink, ClassListEditor],
  templateUrl: './lucky-wheel.html',
})
export class LuckyWheel {
  stage = viewChild<ElementRef<HTMLElement>>('stage');

  names = signal<string[]>(loadClassList());
  /** Names already picked this round (hidden from the wheel when removePicked is on). */
  picked = signal<string[]>([]);
  removePicked = signal(true);
  rotation = signal(0);
  spinning = signal(false);
  winner = signal<string | null>(null);

  pool = computed(() => {
    const done = new Set(this.removePicked() ? this.picked() : []);
    return this.names().filter((n) => !done.has(n));
  });

  segments = computed<Segment[]>(() => {
    const list = this.pool();
    const n = list.length;
    if (n === 0) return [];
    const r = 190;
    const step = (2 * Math.PI) / n;
    return list.map((name, i) => {
      const a0 = i * step - Math.PI / 2;
      const a1 = a0 + step;
      const x0 = 200 + r * Math.cos(a0);
      const y0 = 200 + r * Math.sin(a0);
      const x1 = 200 + r * Math.cos(a1);
      const y1 = 200 + r * Math.sin(a1);
      const large = step > Math.PI ? 1 : 0;
      const path =
        n === 1
          ? `M200,10 A190,190 0 1,1 199.99,10 Z`
          : `M200,200 L${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 ${large},1 ${x1.toFixed(2)},${y1.toFixed(2)} Z`;
      const mid = a0 + step / 2;
      return {
        name,
        path,
        color: COLORS[i % COLORS.length],
        labelX: 200 + r * 0.62 * Math.cos(mid),
        labelY: 200 + r * 0.62 * Math.sin(mid),
        labelAngle: (mid * 180) / Math.PI,
      };
    });
  });

  fontSize = computed(() => {
    const n = this.pool().length;
    return n > 24 ? 10 : n > 14 ? 13 : 16;
  });

  spin() {
    const list = this.pool();
    if (this.spinning() || list.length === 0) return;
    const index = Math.floor(Math.random() * list.length);
    const step = 360 / list.length;
    // The pointer is at the top; segment i spans [i*step, (i+1)*step) clockwise from the top.
    const target = 360 - (index * step + step / 2);
    const current = this.rotation() % 360;
    const extra = 360 * 6 + ((target - current + 360) % 360);
    this.winner.set(null);
    this.spinning.set(true);
    this.rotation.update((r) => r + extra);
    setTimeout(() => {
      this.spinning.set(false);
      this.winner.set(list[index]);
      this.picked.update((p) => [...p, list[index]]);
      sfx.finish();
    }, SPIN_MS);
  }

  resetRound() {
    this.picked.set([]);
    this.winner.set(null);
  }

  fullscreen() {
    toggleFullscreen(this.stage()?.nativeElement);
  }
}
