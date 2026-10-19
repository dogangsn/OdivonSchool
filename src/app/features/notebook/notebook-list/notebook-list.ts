import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../core/services/auth';
import { NotebookService, NoteSummary } from '../../../core/services/notebook';
import { EducationLevel, LEVEL_GRADES, levelForGrade } from '../../../models/test-category';

interface SubjectGroup {
  key: string;
  grade: number;
  subject: string;
  notes: NoteSummary[];
}

const LEVELS: { id: EducationLevel; label: string }[] = [
  { id: 'ilkokul', label: 'İlkokul' },
  { id: 'ortaokul', label: 'Ortaokul' },
  { id: 'lise', label: 'Lise' },
];

/** /defter-notlari: every MEB tema as a konu anlatımlı defter notu. */
@Component({
  selector: 'app-notebook-list',
  imports: [RouterLink],
  templateUrl: './notebook-list.html',
  styleUrl: './notebook-list.scss',
})
export class NotebookList {
  private notebook = inject(NotebookService);
  private auth = inject(AuthService);
  private appUser = toSignal(this.auth.appUser$, { initialValue: null });

  readonly levels = LEVELS;
  all = signal<NoteSummary[]>([]);
  loading = signal(true);
  error = signal(false);

  level = signal<EducationLevel>('ilkokul');
  grade = signal<number | null>(null);
  subject = signal<string>('');
  search = signal('');
  private picked = false;

  grades = computed(() => LEVEL_GRADES[this.level()]);

  subjects = computed(() => {
    const g = this.grade();
    const set = new Set(
      this.all()
        .filter((n) => n.level === this.level() && (g === null || n.grade === g))
        .map((n) => n.subject)
    );
    return [...set].sort((a, b) => a.localeCompare(b, 'tr'));
  });

  groups = computed<SubjectGroup[]>(() => {
    const q = this.search().trim().toLocaleLowerCase('tr');
    const g = this.grade();
    const s = this.subject();
    const rows = this.all().filter(
      (n) =>
        (q ? true : n.level === this.level()) &&
        (q || g === null || n.grade === g) &&
        (q || !s || n.subject === s) &&
        (!q || `${n.title} ${n.subject} ${n.grade}. sınıf ${n.intro}`.toLocaleLowerCase('tr').includes(q))
    );
    const map = new Map<string, SubjectGroup>();
    for (const n of rows) {
      const key = `${n.grade}-${n.subject}`;
      if (!map.has(key)) map.set(key, { key, grade: n.grade, subject: n.subject, notes: [] });
      map.get(key)!.notes.push(n);
    }
    return [...map.values()];
  });

  total = computed(() => this.groups().reduce((sum, g) => sum + g.notes.length, 0));

  constructor() {
    this.load();
    // Open on the student's own sınıf once, without fighting later filter clicks.
    effect(() => {
      const user = this.appUser();
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
      this.all.set(await this.notebook.index());
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
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

  subjectIcon(subject: string): string {
    return SUBJECT_ICONS[subject] ?? '📘';
  }
}

export const SUBJECT_ICONS: Record<string, string> = {
  Türkçe: '📝',
  'Türk Dili ve Edebiyatı': '🖋️',
  Matematik: '➗',
  'Hayat Bilgisi': '🏡',
  'Fen Bilimleri': '🔬',
  Fizik: '🧲',
  Kimya: '⚗️',
  Biyoloji: '🧬',
  'Sosyal Bilgiler': '🌍',
  'T.C. İnkılap Tarihi ve Atatürkçülük': '🇹🇷',
  Tarih: '🏛️',
  Coğrafya: '🗺️',
  İngilizce: '🇬🇧',
};
