import { Component, ElementRef, HostListener, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NoteDetail, NoteSummary, NotebookService } from '../../../core/services/notebook';
import { SUBJECT_ICONS } from '../notebook-list/notebook-list';

/** /defter-notlari/:slug — one tema as a page of lined notebook paper. */
@Component({
  selector: 'app-notebook-note',
  imports: [RouterLink],
  templateUrl: './notebook-note.html',
  styleUrl: './notebook-note.scss',
})
export class NotebookNote {
  private route = inject(ActivatedRoute);
  private notebook = inject(NotebookService);
  private page = viewChild<ElementRef<HTMLElement>>('page');

  note = signal<NoteDetail | null>(null);
  prev = signal<NoteSummary | null>(null);
  next = signal<NoteSummary | null>(null);
  loading = signal(true);
  notFound = signal(false);
  showSolution = signal(false);
  board = signal(false);

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((p) => this.load(p.get('slug') ?? ''));
  }

  private async load(slug: string) {
    this.loading.set(true);
    this.notFound.set(false);
    this.showSolution.set(false);
    try {
      const note = await this.notebook.note(slug);
      this.note.set(note);
      this.notFound.set(!note);
      if (note) {
        const siblings = (await this.notebook.index()).filter(
          (n) => n.grade === note.grade && n.subject === note.subject
        );
        const i = siblings.findIndex((n) => n.slug === slug);
        this.prev.set(siblings[i - 1] ?? null);
        this.next.set(siblings[i + 1] ?? null);
        document.title = `${note.grade}. Sınıf ${note.subject}: ${note.title} Defter Notu | OdivonSchool`;
      }
    } catch {
      this.notFound.set(true);
    } finally {
      this.loading.set(false);
      window.scrollTo({ top: 0 });
    }
  }

  icon(subject: string): string {
    return SUBJECT_ICONS[subject] ?? '📘';
  }

  print() {
    window.print();
  }

  /** Tahta modu: big type on a full-screen sheet for the smart board. */
  async toggleBoard() {
    const on = !this.board();
    this.board.set(on);
    const el = this.page()?.nativeElement;
    try {
      if (on && el?.requestFullscreen && !document.fullscreenElement) await el.requestFullscreen();
      if (!on && document.fullscreenElement) await document.exitFullscreen();
    } catch {
      // Full screen is optional; the larger type still applies.
    }
  }

  @HostListener('document:fullscreenchange')
  onFullscreenChange() {
    if (!document.fullscreenElement && this.board()) this.board.set(false);
  }
}
