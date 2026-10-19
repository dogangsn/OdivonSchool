import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../core/services/auth';
import { BookProgress, LibraryBook, LibraryService } from '../../../core/services/library';
import { EducationLevel, LEVEL_GRADES, levelForGrade } from '../../../models/test-category';
import { SUBJECT_ICONS } from '../../notebook/notebook-list/notebook-list';

const LEVELS: { id: EducationLevel; label: string }[] = [
  { id: 'ilkokul', label: 'İlkokul' },
  { id: 'ortaokul', label: 'Ortaokul' },
  { id: 'lise', label: 'Lise' },
];

/** Cover colours per ders (two-stop gradient). */
const COVERS: Record<string, [string, string]> = {
  Türkçe: ['#ef4444', '#b91c1c'],
  'Türk Dili ve Edebiyatı': ['#e11d48', '#9f1239'],
  Matematik: ['#3b82f6', '#1d4ed8'],
  'Hayat Bilgisi': ['#f59e0b', '#c2410c'],
  'Fen Bilimleri': ['#10b981', '#047857'],
  Fizik: ['#0ea5e9', '#0369a1'],
  Kimya: ['#14b8a6', '#0f766e'],
  Biyoloji: ['#22c55e', '#15803d'],
  'Sosyal Bilgiler': ['#f97316', '#c2410c'],
  'T.C. İnkılap Tarihi ve Atatürkçülük': ['#dc2626', '#7f1d1d'],
  Tarih: ['#a16207', '#713f12'],
  Coğrafya: ['#84cc16', '#4d7c0f'],
  İngilizce: ['#8b5cf6', '#6d28d9'],
};

export function coverStyle(subject: string): string {
  const [a, b] = COVERS[subject] ?? ['#6366f1', '#4338ca'];
  return `linear-gradient(135deg, ${a}, ${b})`;
}

/** /kutuphane — MEB ders kitapları, opened as a page-turning book. */
@Component({
  selector: 'app-library-list',
  imports: [RouterLink],
  templateUrl: './library-list.html',
  styleUrl: './library-list.scss',
})
export class LibraryList {
  private library = inject(LibraryService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private appUser = toSignal(this.auth.appUser$, { initialValue: null });

  readonly levels = LEVELS;
  readonly cover = coverStyle;
  books = signal<LibraryBook[]>([]);
  recent = signal<(BookProgress & { book: LibraryBook })[]>([]);
  loading = signal(true);
  error = signal(false);

  level = signal<EducationLevel>('ilkokul');
  grade = signal<number | null>(null);
  subject = signal('');
  search = signal('');
  private picked = false;

  grades = computed(() => LEVEL_GRADES[this.level()]);

  subjects = computed(() => {
    const g = this.grade();
    const set = new Set(
      this.books()
        .filter((b) => b.level === this.level() && (g === null || b.grade === g))
        .map((b) => b.subject)
    );
    return [...set].sort((a, b) => a.localeCompare(b, 'tr'));
  });

  shown = computed(() => {
    const q = this.search().trim().toLocaleLowerCase('tr');
    const g = this.grade();
    const s = this.subject();
    return this.books().filter((b) =>
      q
        ? `${b.title} ${b.subject} ${b.grade}. sınıf`.toLocaleLowerCase('tr').includes(q)
        : b.level === this.level() && (g === null || b.grade === g) && (!s || b.subject === s)
    );
  });

  constructor() {
    const qp = this.route.snapshot.queryParamMap;
    const qGrade = Number(qp.get('sinif'));
    if (qGrade >= 1 && qGrade <= 12) {
      this.picked = true;
      this.level.set(levelForGrade(qGrade));
      this.grade.set(qGrade);
      this.subject.set(qp.get('ders') ?? '');
    }
    this.load();
    effect(() => {
      const user = this.appUser();
      if (user !== undefined) this.loadRecent(user?.uid ?? null);
      if (this.picked || !user?.grade) return;
      this.picked = true;
      this.level.set(levelForGrade(user.grade));
      this.grade.set(user.grade);
    });
  }

  async load() {
    this.loading.set(true);
    this.error.set(false);
    try {
      this.books.set(await this.library.catalog());
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadRecent(uid: string | null) {
    try {
      const [catalog, recent] = await Promise.all([this.library.catalog(), this.library.recent(uid)]);
      this.recent.set(
        recent
          .map((p) => ({ ...p, book: catalog.find((b) => b.id === p.bookId)! }))
          .filter((p) => !!p.book)
      );
    } catch {
      this.recent.set([]);
    }
  }

  pickLevel(level: EducationLevel) {
    this.picked = true;
    this.level.set(level);
    this.grade.set(null);
    this.subject.set('');
  }

  pickGrade(grade: number | null) {
    this.picked = true;
    this.grade.set(grade);
    if (this.subject() && !this.subjects().includes(this.subject())) this.subject.set('');
  }

  onSubject(event: Event) {
    this.subject.set((event.target as HTMLSelectElement).value);
  }

  onSearch(event: Event) {
    this.search.set((event.target as HTMLInputElement).value);
  }

  icon(subject: string): string {
    return SUBJECT_ICONS[subject] ?? '📘';
  }

  percent(p: BookProgress): number {
    return Math.round((p.page / Math.max(1, p.pageCount)) * 100);
  }
}
