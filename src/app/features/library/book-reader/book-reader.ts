import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { AuthService } from '../../../core/services/auth';
import { LibraryBook, LibraryService } from '../../../core/services/library';
import { coverStyle } from '../library-list/library-list';
import { SUBJECT_ICONS } from '../../notebook/notebook-list/notebook-list';
import { DrawLayer, DrawTool } from '../draw-layer/draw-layer';

type FlipDir = 'next' | 'prev';

/** What the stage shows while a page turns (see flip()). */
interface FlipState {
  dir: FlipDir;
  /** Face of the turning leaf before / after it turns. */
  front: number | null;
  back: number | null;
  /** Pages lying under the leaf. */
  under: number | null;
  /** The page that stays put on the other side. */
  still: number | null;
}

const PDFJS = '/pdfjs/';
const FLIP_MS = 650;
const DOUBLE_MIN_WIDTH = 860;

/**
 * /kutuphane/:bookId — a MEB ders kitabı as a page-turning book.
 * pdf.js renders each page to an image; on wide screens two pages face each
 * other and the right one turns over its spine.
 */
@Component({
  selector: 'app-book-reader',
  imports: [RouterLink, NgTemplateOutlet, DrawLayer],
  templateUrl: './book-reader.html',
  styleUrl: './book-reader.scss',
})
export class BookReader implements OnDestroy {
  private route = inject(ActivatedRoute);
  private library = inject(LibraryService);
  private auth = inject(AuthService);
  private appUser = toSignal(this.auth.appUser$, { initialValue: null });
  private stageRef = viewChild<ElementRef<HTMLElement>>('stage');
  private shellRef = viewChild<ElementRef<HTMLElement>>('shell');
  private leafRef = viewChild<ElementRef<HTMLElement>>('leaf');

  book = signal<LibraryBook | null>(null);
  status = signal<'loading' | 'ready' | 'blocked' | 'missing' | 'error'>('loading');
  loadNote = signal('Kitap MEB sunucusundan açılıyor...');
  pageCount = signal(0);
  /** 1-based page the reader is on (left page of a spread counts as its pair). */
  page = signal(1);
  double = signal(true);
  zoom = signal(false);
  flipping = signal<FlipState | null>(null);
  resumedFrom = signal<number | null>(null);
  images = signal<Record<number, string>>({});
  /** Kalem modu: the stage stops turning pages and takes strokes instead. */
  drawMode = signal(false);
  drawTool = signal<DrawTool>('pen');
  drawColor = signal('#e11d48');
  clearTick = signal(0);
  readonly penColors = ['#e11d48', '#2563eb', '#16a34a', '#0f172a'];
  pageW = signal(420);
  pageH = signal(594);

  private pdf: PDFDocumentProxy | null = null;
  private aspect = 0.707;
  private rendering = new Set<number>();
  private queue: number[] = [];
  private pumping = false;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private resizeObs: ResizeObserver | null = null;
  private destroyed = false;
  private pointerX: number | null = null;
  private renderWidth = 0;

  readonly icon = (s: string) => SUBJECT_ICONS[s] ?? '📘';
  readonly cover = coverStyle;

  /** Pages visible when no page is turning: [left, right] or [single]. */
  spread = computed<[number | null, number | null]>(() => {
    const p = this.page();
    const n = this.pageCount();
    if (!this.double()) return [null, p];
    const left = p % 2 === 0 ? p : p - 1; // spreads: [-,1] [2,3] [4,5] ...
    return [left >= 1 ? left : null, left + 1 <= n ? left + 1 : null];
  });

  pageLabel = computed(() => {
    const [l, r] = this.spread();
    if (l && r) return `${l}-${r}`;
    return `${l ?? r ?? 1}`;
  });

  canPrev = computed(() => (this.double() ? !!this.spread()[0] : this.page() > 1));
  canNext = computed(() => {
    const [, r] = this.spread();
    return this.double() ? !!r && r < this.pageCount() : this.page() < this.pageCount();
  });

  constructor() {
    const id = Number(this.route.snapshot.paramMap.get('bookId'));
    this.open(id);
  }

  // ---- Loading ----

  private async open(id: number) {
    let book: LibraryBook | null = null;
    try {
      book = await this.library.book(id);
    } catch {
      this.status.set('error');
      return;
    }
    if (!book) {
      this.status.set('missing');
      return;
    }
    this.book.set(book);
    document.title = `${book.title} | Akıllı Kütüphane`;

    const sources = this.library.pdfSources(book);
    for (const [i, url] of sources.entries()) {
      if (i > 0) this.loadNote.set('MEB bağlantısı yanıt vermedi, yedek yoldan deneniyor...');
      if (await this.loadPdf({ url })) return;
      if (this.destroyed) return;
    }
    this.status.set('blocked');
  }

  /** Reader picked a PDF they downloaded from MEB; it stays on their device. */
  async openLocalFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.status.set('loading');
    this.loadNote.set('Seçtiğin PDF açılıyor...');
    const data = new Uint8Array(await file.arrayBuffer());
    if (!(await this.loadPdf({ data }))) this.status.set('error');
  }

  private async loadPdf(src: { url?: string; data?: Uint8Array }): Promise<boolean> {
    try {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc = `${PDFJS}pdf.worker.min.mjs`;
      const task = pdfjs.getDocument({
        ...src,
        cMapUrl: `${PDFJS}cmaps/`,
        cMapPacked: true,
        standardFontDataUrl: `${PDFJS}standard_fonts/`,
        wasmUrl: `${PDFJS}wasm/`,
        disableAutoFetch: true,
      });
      const pdf = await task.promise;
      if (this.destroyed) {
        pdf.destroy();
        return true;
      }
      this.resetPdf();
      this.pdf = pdf;
      const first = await pdf.getPage(1);
      const vp = first.getViewport({ scale: 1 });
      this.aspect = vp.width / vp.height;
      this.pageCount.set(pdf.numPages);
      await this.restoreProgress();
      this.status.set('ready');
      setTimeout(() => {
        // On phones the site header is tall; bring the whole reader into view.
        if (window.innerWidth <= 640) this.shellRef()?.nativeElement.scrollIntoView({ block: 'start' });
        this.observeSize();
      });
      return true;
    } catch (err) {
      console.warn('[Kütüphane] PDF açılamadı:', err);
      return false;
    }
  }

  private async restoreProgress() {
    const book = this.book();
    if (!book) return;
    const saved = await this.library.progress(this.appUser()?.uid ?? null, book.id);
    if (saved && saved.page > 1 && saved.page <= this.pageCount()) {
      this.page.set(saved.page);
      this.resumedFrom.set(saved.page);
    }
  }

  private resetPdf() {
    for (const url of Object.values(this.images())) URL.revokeObjectURL(url);
    this.images.set({});
    this.queue = [];
    this.rendering.clear();
    this.pdf?.destroy();
    this.pdf = null;
  }

  // ---- Layout ----

  private observeSize() {
    const stage = this.stageRef()?.nativeElement;
    if (!stage || this.resizeObs) return;
    this.resizeObs = new ResizeObserver(() => this.layout());
    this.resizeObs.observe(stage);
    this.layout();
  }

  private layout() {
    const stage = this.stageRef()?.nativeElement;
    if (!stage) return;
    const availW = stage.clientWidth - 24;
    const availH = Math.max(320, stage.clientHeight - 24);
    const double = availW >= DOUBLE_MIN_WIDTH && this.aspect < 1.1;
    this.double.set(double);
    const cols = double ? 2 : 1;
    let w = Math.min(availW / cols, availH * this.aspect);
    w = Math.max(200, Math.floor(w));
    this.pageW.set(w);
    this.pageH.set(Math.floor(w / this.aspect));

    // Render sharp enough for the zoom view; re-render only if pages grow a lot.
    const want = Math.min(2000, Math.ceil(w * Math.min(window.devicePixelRatio || 1, 2) * 1.5));
    if (want > this.renderWidth * 1.25) {
      this.renderWidth = want;
      for (const url of Object.values(this.images())) URL.revokeObjectURL(url);
      this.images.set({});
    }
    this.prefetch();
  }

  // ---- Rendering ----

  private prefetch() {
    const p = this.page();
    const n = this.pageCount();
    const wanted: number[] = [];
    for (const d of [0, 1, -1, 2, 3, -2, 4, 5, -3]) {
      const q = p + d;
      if (q >= 1 && q <= n) wanted.push(q);
    }
    this.queue = [...wanted.filter((q) => !this.images()[q] && !this.rendering.has(q))];
    this.trimCache(wanted);
    this.pump();
  }

  /** Keep ~24 pages around the reader; drop the rest to save memory. */
  private trimCache(keep: number[]) {
    const imgs = this.images();
    const keys = Object.keys(imgs).map(Number);
    if (keys.length <= 24) return;
    const p = this.page();
    const next = { ...imgs };
    keys
      .filter((k) => !keep.includes(k))
      .sort((a, b) => Math.abs(b - p) - Math.abs(a - p))
      .slice(0, keys.length - 24)
      .forEach((k) => {
        URL.revokeObjectURL(next[k]);
        delete next[k];
      });
    this.images.set(next);
  }

  private async pump() {
    if (this.pumping) return;
    this.pumping = true;
    try {
      while (this.queue.length && this.pdf && !this.destroyed) {
        const num = this.queue.shift()!;
        if (this.images()[num] || this.rendering.has(num)) continue;
        this.rendering.add(num);
        try {
          const url = await this.renderPage(num);
          if (url) this.images.update((m) => ({ ...m, [num]: url }));
        } catch (err) {
          console.warn(`[Kütüphane] sayfa ${num} çizilemedi:`, err);
        } finally {
          this.rendering.delete(num);
        }
      }
    } finally {
      this.pumping = false;
    }
  }

  private async renderPage(num: number): Promise<string | null> {
    const pdf = this.pdf;
    if (!pdf) return null;
    const page = await pdf.getPage(num);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: (this.renderWidth || 1200) / base.width });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    await page.render({ canvas, viewport }).promise;
    page.cleanup();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.88));
    canvas.width = canvas.height = 0;
    return blob && pdf === this.pdf ? URL.createObjectURL(blob) : null;
  }

  img(num: number | null): string | null {
    return num ? this.images()[num] ?? null : null;
  }

  // ---- Turning pages ----

  next() {
    this.flip('next');
  }

  prev() {
    this.flip('prev');
  }

  private async flip(dir: FlipDir) {
    if (this.flipping() || this.status() !== 'ready') return;
    if (dir === 'next' ? !this.canNext() : !this.canPrev()) return;
    const n = this.pageCount();
    const [l, r] = this.spread();
    const page = (x: number) => (x >= 1 && x <= n ? x : null);
    let target: number;
    let state: FlipState;

    if (this.double()) {
      if (dir === 'next') {
        const nl = (r ?? 0) + 1;
        target = nl;
        state = { dir, front: r, back: page(nl), under: page(nl + 1), still: l };
      } else {
        const pl = (l ?? 1) - 2;
        target = Math.max(1, pl);
        state = { dir, front: l, back: page(pl + 1), under: page(pl), still: r };
      }
    } else {
      target = this.page() + (dir === 'next' ? 1 : -1);
      state =
        dir === 'next'
          ? { dir, front: this.page(), back: null, under: target, still: null }
          : { dir, front: target, back: null, under: this.page(), still: null };
    }

    // Make sure the faces are drawn before the leaf starts moving.
    this.queue.unshift(...[state.front, state.back, state.under].filter((x): x is number => !!x && !this.images()[x]));
    this.pump();

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      this.goTo(target);
      return;
    }

    this.flipping.set(state);
    await new Promise((res) => setTimeout(res)); // let the leaf mount
    const leaf = this.leafRef()?.nativeElement;
    const single = !this.double();
    const frames: Keyframe[] =
      dir === 'next'
        ? [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(-180deg)' }]
        : single
          ? [{ transform: 'rotateY(-180deg)' }, { transform: 'rotateY(0deg)' }]
          : [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(180deg)' }];
    try {
      await leaf?.animate(frames, { duration: FLIP_MS, easing: 'cubic-bezier(0.45, 0.05, 0.3, 1)', fill: 'forwards' })
        .finished;
    } catch {
      // Animation cancelled (navigated away); just jump.
    }
    this.goTo(target);
    this.flipping.set(null);
  }

  goTo(num: number) {
    const n = this.pageCount();
    const p = Math.min(Math.max(1, Math.round(num)), Math.max(1, n));
    this.page.set(p);
    this.prefetch();
    this.scheduleSave();
  }

  onSlider(event: Event) {
    this.goTo(Number((event.target as HTMLInputElement).value));
  }

  restart() {
    this.resumedFrom.set(null);
    this.goTo(1);
  }

  /** Click on the right half turns forward, on the left half back. */
  toggleDraw() {
    this.drawMode.update((v) => !v);
  }

  pickPen(color: string) {
    this.drawTool.set('pen');
    this.drawColor.set(color);
  }

  clearDrawing() {
    this.clearTick.update((n) => n + 1);
  }

  onStageClick(event: MouseEvent) {
    if (this.zoom() || this.drawMode()) return;
    const stage = this.stageRef()?.nativeElement;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    if (event.clientX - rect.left > rect.width / 2) this.next();
    else this.prev();
  }

  onPointerDown(event: PointerEvent) {
    this.pointerX = event.clientX;
  }

  onPointerUp(event: PointerEvent) {
    if (this.pointerX === null || this.zoom() || this.drawMode()) return;
    const dx = event.clientX - this.pointerX;
    this.pointerX = null;
    if (Math.abs(dx) < 50) return;
    if (dx < 0) this.next();
    else this.prev();
  }

  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent) {
    if (this.status() !== 'ready') return;
    const tag = (event.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (event.key === 'ArrowRight' || event.key === 'PageDown') this.next();
    else if (event.key === 'ArrowLeft' || event.key === 'PageUp') this.prev();
    else if (event.key === 'Home') this.goTo(1);
    else if (event.key === 'End') this.goTo(this.pageCount());
    else return;
    event.preventDefault();
  }

  toggleZoom() {
    this.zoom.update((z) => !z);
  }

  async toggleFullscreen() {
    const el = this.shellRef()?.nativeElement;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await el?.requestFullscreen();
    } catch {
      // Not supported (e.g. iPhone Safari); the reader still works.
    }
  }

  // ---- Progress ----

  private scheduleSave() {
    const book = this.book();
    if (!book || !this.pageCount()) return;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.library.saveProgress(this.appUser()?.uid ?? null, {
        bookId: book.id,
        page: this.page(),
        pageCount: this.pageCount(),
        updatedAt: Date.now(),
      });
    }, 1200);
  }

  ngOnDestroy() {
    this.destroyed = true;
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      const book = this.book();
      if (book && this.pageCount()) {
        this.library.saveProgress(this.appUser()?.uid ?? null, {
          bookId: book.id,
          page: this.page(),
          pageCount: this.pageCount(),
          updatedAt: Date.now(),
        });
      }
    }
    this.resizeObs?.disconnect();
    this.resetPdf();
  }
}
