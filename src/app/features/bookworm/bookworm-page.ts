import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, map, of, switchMap } from 'rxjs';
import { AuthService } from '../../core/services/auth';
import { BookwormService } from '../../core/services/bookworm';
import { ClassroomService } from '../../core/services/classroom';
import { BookEntry, BookwormSummary, provinceForBook, validateBook } from '../../games/bookworm';
import { Classroom } from '../../models/classroom';
import { isStudent, isTeacher } from '../../models/user';
import { ProvinceMap } from './province-map';
import { localDay } from '../../games/scoring';

interface ClassView {
  cls: Classroom;
  rows: BookwormSummary[];
  books: number;
  pages: number;
}

/** /okuma-kurdu — book log for students, class reading map for everyone in the class. */
@Component({
  selector: 'app-bookworm-page',
  imports: [RouterLink, ProvinceMap],
  templateUrl: './bookworm-page.html',
  styleUrl: './bookworm-page.scss',
})
export class BookwormPage {
  private auth = inject(AuthService);
  private bookworm = inject(BookwormService);
  private classroom = inject(ClassroomService);

  user = toSignal(this.auth.appUser$, { initialValue: null });
  student = computed(() => isStudent(this.user()));
  teacher = computed(() => isTeacher(this.user()) || this.user()?.role === 'admin');

  books = toSignal(
    toObservable(this.user).pipe(switchMap((u) => (u && isStudent(u) ? this.bookworm.myBooks(u.uid) : of([])))),
    { initialValue: [] as BookEntry[] }
  );

  private classes = toSignal(
    toObservable(this.user).pipe(
      switchMap((u) => {
        if (!u) return of([] as Classroom[]);
        if (isStudent(u)) return this.classroom.studentClasses(u);
        return this.classroom.myClasses(u.uid).pipe(map((list) => list.filter((c) => !c.archived)));
      })
    ),
    { initialValue: [] as Classroom[] }
  );

  classViews = toSignal(
    toObservable(this.classes).pipe(
      switchMap((list) =>
        list.length === 0
          ? of([] as ClassView[])
          : combineLatest(
              list.map((cls) =>
                this.bookworm.classBookworms(cls.id).pipe(
                  map((rows) => {
                    const sorted = [...rows].sort((a, b) => b.books - a.books || a.displayName.localeCompare(b.displayName, 'tr'));
                    return {
                      cls,
                      rows: sorted,
                      books: rows.reduce((n, r) => n + r.books, 0),
                      pages: rows.reduce((n, r) => n + r.pages, 0),
                    };
                  })
                )
              )
            )
      )
    ),
    { initialValue: [] as ClassView[] }
  );

  selectedClass = signal<string | null>(null);
  activeClass = computed<ClassView | null>(() => {
    const views = this.classViews();
    return views.find((v) => v.cls.id === this.selectedClass()) ?? views[0] ?? null;
  });
  activeId = computed(() => this.activeClass()?.cls.id ?? '');

  // form
  title = signal('');
  author = signal('');
  pages = signal<number | null>(null);
  finishedOn = signal(localDay(new Date()));
  rating = signal(0);
  saving = signal(false);
  error = signal('');
  justOpened = signal<string | null>(null);

  totalPages = computed(() => this.books().reduce((n, b) => n + b.pages, 0));

  constructor() {
    effect(() => {
      if (this.justOpened()) setTimeout(() => this.justOpened.set(null), 5000);
    });
  }

  async add() {
    const u = this.user();
    if (!u || this.saving()) return;
    const r = validateBook({
      title: this.title(),
      author: this.author(),
      pages: this.pages() ?? 0,
      finishedOn: this.finishedOn(),
      rating: this.rating(),
    });
    if (!r.ok) {
      this.error.set(r.error);
      return;
    }
    this.error.set('');
    this.saving.set(true);
    try {
      await this.bookworm.addBook(u, r.book, this.books());
      this.justOpened.set(provinceForBook(this.books().length + 1).name);
      this.title.set('');
      this.author.set('');
      this.pages.set(null);
      this.rating.set(0);
    } catch {
      this.error.set('Kitap kaydedilemedi. İnternet bağlantını kontrol edip tekrar dene.');
    } finally {
      this.saving.set(false);
    }
  }

  async remove(b: BookEntry) {
    const u = this.user();
    if (!u || !confirm(`"${b.title}" listeden silinsin mi?`)) return;
    await this.bookworm.removeBook(u, b.id, this.books());
  }

  stars(n: number) {
    return '★'.repeat(n) + '☆'.repeat(5 - n);
  }
}
