import { Component, ElementRef, OnDestroy, effect, input, signal, viewChild } from '@angular/core';

export type DrawTool = 'pen' | 'marker' | 'eraser';

interface Stroke {
  tool: DrawTool;
  color: string;
  /** Normalized 0..1 points, so strokes survive resizes and zoom. */
  points: [number, number][];
}

const WIDTH: Record<DrawTool, number> = { pen: 0.004, marker: 0.022, eraser: 0.03 };

/**
 * Kalem / fosforlu kalem / silgi layer over the book pages. Strokes are kept in
 * memory per page key (going back shows them again) and never uploaded.
 */
@Component({
  selector: 'app-draw-layer',
  template: `<canvas
    #canvas
    class="draw-canvas"
    [class.active]="active()"
    (pointerdown)="down($event)"
    (pointermove)="move($event)"
    (pointerup)="up($event)"
    (pointercancel)="up($event)"
    (click)="$event.stopPropagation()"
  ></canvas>`,
  styles: `
    :host {
      position: absolute;
      inset: 0;
      z-index: 5;
      pointer-events: none;
    }
    .draw-canvas {
      width: 100%;
      height: 100%;
      display: block;
      touch-action: none;
    }
    .draw-canvas.active {
      pointer-events: auto;
      cursor: crosshair;
    }
  `,
})
export class DrawLayer implements OnDestroy {
  active = input(false);
  tool = input<DrawTool>('pen');
  color = input('#e11d48');
  /** Which page(s) are showing; strokes are stored under this key. */
  pageKey = input('1');
  /** Bump to clear the current page. */
  clearSignal = input(0);

  private canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private store = new Map<string, Stroke[]>();
  private drawing: Stroke | null = null;
  private resizeObs: ResizeObserver | null = null;
  hasStrokes = signal(false);

  constructor() {
    effect(() => {
      this.pageKey();
      this.redraw();
    });
    let lastClear = 0;
    effect(() => {
      const c = this.clearSignal();
      if (c !== lastClear) {
        lastClear = c;
        this.store.delete(this.pageKey());
        this.redraw();
      }
    });
  }

  ngAfterViewInit() {
    const canvas = this.canvasRef().nativeElement;
    this.resizeObs = new ResizeObserver(() => this.redraw());
    this.resizeObs.observe(canvas);
  }

  ngOnDestroy() {
    this.resizeObs?.disconnect();
  }

  down(e: PointerEvent) {
    if (!this.active()) return;
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    this.drawing = { tool: this.tool(), color: this.color(), points: [this.norm(e)] };
    const list = this.store.get(this.pageKey()) ?? [];
    list.push(this.drawing);
    this.store.set(this.pageKey(), list);
  }

  move(e: PointerEvent) {
    if (!this.drawing) return;
    e.stopPropagation();
    this.drawing.points.push(this.norm(e));
    this.redraw();
  }

  up(e: PointerEvent) {
    if (!this.drawing) return;
    e.stopPropagation();
    this.drawing = null;
    this.redraw();
  }

  private norm(e: PointerEvent): [number, number] {
    const r = this.canvasRef().nativeElement.getBoundingClientRect();
    return [(e.clientX - r.left) / Math.max(1, r.width), (e.clientY - r.top) / Math.max(1, r.height)];
  }

  private redraw() {
    const canvas = this.canvasRef?.()?.nativeElement;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const strokes = this.store.get(this.pageKey()) ?? [];
    this.hasStrokes.set(strokes.length > 0);
    for (const s of strokes) {
      if (s.points.length === 0) continue;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(2, WIDTH[s.tool] * w);
      if (s.tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = '#000';
      } else {
        ctx.globalCompositeOperation = s.tool === 'marker' ? 'multiply' : 'source-over';
        ctx.globalAlpha = s.tool === 'marker' ? 0.35 : 1;
        ctx.strokeStyle = s.color;
      }
      ctx.beginPath();
      const [x0, y0] = s.points[0];
      ctx.moveTo(x0 * w, y0 * h);
      if (s.points.length === 1) ctx.lineTo(x0 * w + 0.1, y0 * h + 0.1);
      for (const [x, y] of s.points.slice(1)) ctx.lineTo(x * w, y * h);
      ctx.stroke();
      ctx.restore();
    }
  }
}
