import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { NoteDetail, NoteSummary, NotebookService } from '../../core/services/notebook';
import { AuthService } from '../../core/services/auth';
import { EducationLevel } from '../../models/test-category';
import {
  PlanRow,
  buildAnnualPlan,
  mondayOf,
  planToWordHtml,
  shortDay,
  suggestedWeeklyHours,
} from '../../tools/annual-plan';

const LEVELS: { id: EducationLevel; title: string }[] = [
  { id: 'ilkokul', title: 'İlkokul' },
  { id: 'ortaokul', title: 'Ortaokul' },
  { id: 'lise', title: 'Lise' },
];

const KEY = 'odivon_evrak_info';

/** Estimated 2026-2027 holiday weeks; the teacher edits them to the real calendar. */
const DEFAULT_HOLIDAYS = [
  { monday: '2026-11-09', label: '1. ara tatil' },
  { monday: '2027-01-25', label: 'Yarıyıl tatili' },
  { monday: '2027-02-01', label: 'Yarıyıl tatili' },
  { monday: '2027-03-22', label: '2. ara tatil' },
];

interface Holiday {
  monday: string;
  label: string;
}

function loadInfo(): { school: string; teacher: string } {
  try {
    return { school: '', teacher: '', ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { school: '', teacher: '' };
  }
}

/** /evraklar — Yıllık plan oluşturucu (Word / yazdır). */
@Component({
  selector: 'app-annual-plan-page',
  imports: [RouterLink],
  templateUrl: './annual-plan-page.html',
  styleUrl: './annual-plan-page.scss',
})
export class AnnualPlanPage {
  private notebook = inject(NotebookService);
  private auth = inject(AuthService);
  private user = toSignal(this.auth.appUser$, { initialValue: null });

  readonly levels = LEVELS;
  readonly short = shortDay;

  index = signal<NoteSummary[]>([]);
  loadError = signal(false);
  level = signal<EducationLevel>('ilkokul');
  grade = signal(1);
  subject = signal('');
  themes = signal<NoteDetail[]>([]);
  loading = signal(false);

  school = signal(loadInfo().school);
  teacher = signal(loadInfo().teacher);
  year = signal('2026-2027');
  start = signal('2026-09-14');
  teachingWeeks = signal(36);
  weeklyHours = signal<number | null>(null);
  holidays = signal<Holiday[]>(DEFAULT_HOLIDAYS);

  grades = computed(() => [...new Set(this.index().filter((r) => r.level === this.level()).map((r) => r.grade))].sort((a, b) => a - b));
  subjects = computed(() =>
    [...new Set(this.index().filter((r) => r.level === this.level() && r.grade === this.grade()).map((r) => r.subject))].sort((a, b) =>
      a.localeCompare(b, 'tr')
    )
  );

  planThemes = computed(() =>
    this.themes().map((t) => ({ order: t.order, title: t.title, hours: t.hours, keyConcepts: t.keyConcepts, outcomes: t.outcomes }))
  );
  suggestedHours = computed(() => suggestedWeeklyHours(this.planThemes(), this.teachingWeeks()));
  hours = computed(() => this.weeklyHours() ?? this.suggestedHours());
  totalHours = computed(() => this.themes().reduce((n, t) => n + (t.hours ?? 0), 0));

  rows = computed<PlanRow[]>(() =>
    this.themes().length
      ? buildAnnualPlan(this.planThemes(), {
          start: this.start(),
          teachingWeeks: this.teachingWeeks(),
          weeklyHours: this.hours(),
          holidays: this.holidays().map((h) => h.monday),
          holidayLabels: Object.fromEntries(this.holidays().map((h) => [mondayOf(h.monday), h.label])),
        })
      : []
  );

  constructor() {
    this.notebook
      .index()
      .then((rows) => this.index.set(rows))
      .catch(() => this.loadError.set(true));

    effect(() => {
      const u = this.user();
      untracked(() => {
        if (u?.displayName && !this.teacher()) this.teacher.set(u.displayName);
        if (u?.school && !this.school()) this.school.set(u.school);
      });
    });

    // Keep grade/subject valid when the level changes.
    effect(() => {
      const gs = this.grades();
      untracked(() => {
        if (gs.length && !gs.includes(this.grade())) this.grade.set(gs[0]);
      });
    });
    effect(() => {
      const ss = this.subjects();
      untracked(() => {
        if (ss.length && !ss.includes(this.subject())) this.subject.set(ss[0]);
      });
    });

    effect(() => {
      const [lvl, g, s] = [this.level(), this.grade(), this.subject()];
      if (!s) return;
      untracked(() => void this.loadThemes(g, s, lvl));
    });
  }

  setInfo(field: 'school' | 'teacher', value: string) {
    (field === 'school' ? this.school : this.teacher).set(value);
    try {
      localStorage.setItem(KEY, JSON.stringify({ school: this.school(), teacher: this.teacher() }));
    } catch {
      // not persisted
    }
  }

  setHours(v: string) {
    const n = parseInt(v, 10);
    this.weeklyHours.set(n > 0 ? Math.min(40, n) : null);
  }

  setWeeks(v: string) {
    this.teachingWeeks.set(Math.max(1, Math.min(52, parseInt(v, 10) || 36)));
  }

  addHoliday() {
    this.holidays.update((h) => [...h, { monday: mondayOf(this.start()), label: 'Tatil' }]);
  }

  updateHoliday(i: number, field: keyof Holiday, value: string) {
    this.holidays.update((list) => list.map((h, k) => (k === i ? { ...h, [field]: field === 'monday' ? mondayOf(value) : value } : h)));
  }

  removeHoliday(i: number) {
    this.holidays.update((list) => list.filter((_, k) => k !== i));
  }

  downloadWord() {
    const html = planToWordHtml(this.rows(), {
      title: `${this.grade()}. Sınıf ${this.subject()} Yıllık Plan`,
      school: this.school() || 'Okul Adı',
      teacher: this.teacher(),
      year: this.year(),
      subject: this.subject(),
      grade: this.grade(),
    });
    const blob = new Blob(['﻿', html], { type: 'application/msword' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${this.grade()}-sinif-${this.subject().toLocaleLowerCase('tr').replace(/\s+/g, '-')}-yillik-plan.doc`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  print() {
    window.print();
  }

  private async loadThemes(grade: number, subject: string, level: EducationLevel) {
    this.loading.set(true);
    try {
      const list = await this.notebook.themes(grade, subject, level);
      if (this.grade() === grade && this.subject() === subject && this.level() === level) this.themes.set(list);
    } catch {
      this.loadError.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}
