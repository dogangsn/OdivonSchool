import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { FirestoreService } from '../../../core/services/firestore';
import { AdminService, CategoryPoolStat } from '../../../core/services/admin';
import { NotificationService } from '../../../core/services/notifications';
import { DUPLICATE_SIMILARITY, similarity } from '../../../core/question-criteria';
import { Question } from '../../../models/question';
import { EducationLevel, TestCategory } from '../../../models/test-category';
import { AdminNav } from '../admin-nav/admin-nav';

/** A test asks for 10 questions; fewer than this and every test repeats. */
export const POOL_TARGET = 10;

const LEVEL_ORDER: EducationLevel[] = ['ilkokul', 'ortaokul', 'lise', 'kpss'];
const LEVEL_LABELS: Record<EducationLevel, string> = { ilkokul: 'İlkokul', ortaokul: 'Ortaokul', lise: 'Lise', kpss: 'KPSS' };

interface Row {
  cat: TestCategory;
  approved: number;
  draft: number;
}

interface SubjectRow {
  key: string;
  level: EducationLevel;
  subject: string;
  topics: number;
  approved: number;
  draft: number;
  weak: number;
}

type StatusFilter = 'all' | 'approved' | 'draft';

@Component({
  selector: 'app-question-pool',
  imports: [RouterLink, DatePipe, AdminNav],
  templateUrl: './question-pool.html',
  styleUrl: './question-pool.scss',
})
export class QuestionPool {
  readonly target = POOL_TARGET;
  readonly levels = LEVEL_ORDER;
  readonly levelLabels = LEVEL_LABELS;

  private firestoreSvc = inject(FirestoreService);
  private admin = inject(AdminService);
  private notifications = inject(NotificationService);

  categories = toSignal(this.firestoreSvc.allCategories(), { initialValue: [] as TestCategory[] });

  stats = signal<CategoryPoolStat[] | null>(this.admin.cachedPoolStats?.stats ?? null);
  statsAt = signal<number | null>(this.admin.cachedPoolStats?.at ?? null);
  counting = signal(false);
  countError = signal<string | null>(null);

  // Filters
  level = signal<'all' | EducationLevel>('all');
  grade = signal<number | 0>(0);
  subject = signal('all');
  search = signal('');
  onlyWeak = signal(false);

  rows = computed<Row[]>(() => {
    const byId = new Map((this.stats() ?? []).map((s) => [s.categoryId, s]));
    return this.categories()
      .map((cat) => ({ cat, approved: byId.get(cat.id)?.approved ?? 0, draft: byId.get(cat.id)?.draft ?? 0 }))
      .sort(
        (a, b) =>
          LEVEL_ORDER.indexOf(a.cat.level) - LEVEL_ORDER.indexOf(b.cat.level) ||
          (a.cat.grades?.[0] ?? 0) - (b.cat.grades?.[0] ?? 0) ||
          a.cat.subject.localeCompare(b.cat.subject, 'tr') ||
          (a.cat.order ?? 0) - (b.cat.order ?? 0)
      );
  });

  gradeOptions = computed(() => {
    const set = new Set<number>();
    for (const c of this.categories()) {
      if (this.level() !== 'all' && c.level !== this.level()) continue;
      for (const g of c.grades ?? []) set.add(g);
    }
    return [...set].sort((a, b) => a - b);
  });

  subjectOptions = computed(() => {
    const set = new Set<string>();
    for (const c of this.categories()) {
      if (this.level() !== 'all' && c.level !== this.level()) continue;
      set.add(c.subject);
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'tr'));
  });

  /** Rows matching level/grade/subject/search (before the "weak only" switch). */
  private scoped = computed(() => {
    const term = this.search().toLocaleLowerCase('tr').trim();
    return this.rows().filter(({ cat }) => {
      if (this.level() !== 'all' && cat.level !== this.level()) return false;
      if (this.grade() && cat.grades && !cat.grades.includes(this.grade())) return false;
      if (this.subject() !== 'all' && cat.subject !== this.subject()) return false;
      if (term && !`${cat.topic} ${cat.subject} ${cat.id}`.toLocaleLowerCase('tr').includes(term)) return false;
      return true;
    });
  });

  filtered = computed(() =>
    this.onlyWeak() ? this.scoped().filter((r) => r.approved < POOL_TARGET) : this.scoped()
  );

  totals = computed(() => {
    const list = this.scoped();
    return {
      topics: list.length,
      approved: list.reduce((s, r) => s + r.approved, 0),
      draft: list.reduce((s, r) => s + r.draft, 0),
      empty: list.filter((r) => r.approved === 0).length,
      weak: list.filter((r) => r.approved < POOL_TARGET).length,
      ready: list.filter((r) => r.approved >= POOL_TARGET).length,
    };
  });

  subjects = computed<SubjectRow[]>(() => {
    const map = new Map<string, SubjectRow>();
    for (const r of this.scoped()) {
      const key = `${r.cat.level}|${r.cat.subject}`;
      const row =
        map.get(key) ??
        { key, level: r.cat.level, subject: r.cat.subject, topics: 0, approved: 0, draft: 0, weak: 0 };
      row.topics++;
      row.approved += r.approved;
      row.draft += r.draft;
      if (r.approved < POOL_TARGET) row.weak++;
      map.set(key, row);
    }
    return [...map.values()];
  });

  // ---- Drawer: questions of one konu ----
  openCat = signal<TestCategory | null>(null);
  questions = signal<Question[]>([]);
  loadingQuestions = signal(false);
  qStatus = signal<StatusFilter>('all');
  qSearch = signal('');
  busyId = signal<string | null>(null);
  drawerMsg = signal<{ type: 'success' | 'danger'; text: string } | null>(null);

  visibleQuestions = computed(() => {
    const term = this.qSearch().toLocaleLowerCase('tr').trim();
    return this.questions().filter((q) => {
      if (this.qStatus() !== 'all' && q.reviewStatus !== this.qStatus()) return false;
      if (term && !`${q.prompt} ${q.outcomeCode ?? ''} ${q.authorName ?? ''}`.toLocaleLowerCase('tr').includes(term)) {
        return false;
      }
      return true;
    });
  });

  /** id -> id of an earlier, near-identical question in the same konu. */
  duplicates = computed(() => {
    const list = this.questions();
    const out = new Map<string, string>();
    for (let i = 0; i < list.length; i++) {
      for (let j = 0; j < i; j++) {
        if (similarity(list[i].prompt, list[j].prompt) >= DUPLICATE_SIMILARITY) {
          out.set(list[i].id, list[j].id);
          break;
        }
      }
    }
    return out;
  });

  // Edit form
  editingId = signal<string | null>(null);
  editPrompt = signal('');
  editOptions = signal<{ id: string; text: string }[]>([]);
  editCorrect = signal('a');
  editExplanation = signal('');
  editDifficulty = signal<number>(2);
  editOutcome = signal('');

  constructor() {
    if (!this.stats()) this.count();
  }

  async count() {
    this.counting.set(true);
    this.countError.set(null);
    try {
      // Categories arrive from a listener; wait for the first non-empty list.
      let cats = this.categories();
      for (let i = 0; cats.length === 0 && i < 50; i++) {
        await new Promise((r) => setTimeout(r, 100));
        cats = this.categories();
      }
      const stats = await this.admin.poolStats(cats);
      this.stats.set(stats);
      this.statsAt.set(Date.now());
    } catch (err: any) {
      this.countError.set(err?.message ?? 'Sayım yapılamadı.');
    } finally {
      this.counting.set(false);
    }
  }

  setLevel(v: 'all' | EducationLevel) {
    this.level.set(v);
    this.grade.set(0);
    this.subject.set('all');
  }

  focusSubject(s: SubjectRow) {
    this.level.set(s.level);
    this.subject.set(s.subject);
  }

  gradeLabel(cat: TestCategory): string {
    if (!cat.grades?.length) return LEVEL_LABELS[cat.level];
    if (cat.grades.length === 1) return `${cat.grades[0]}. sınıf`;
    return `${cat.grades[0]}-${cat.grades[cat.grades.length - 1]}. sınıf`;
  }

  barPct(n: number): number {
    return Math.min(100, (n / POOL_TARGET) * 100);
  }

  async openCategory(cat: TestCategory) {
    this.openCat.set(cat);
    this.qStatus.set('all');
    this.qSearch.set('');
    this.drawerMsg.set(null);
    this.editingId.set(null);
    await this.reloadQuestions();
  }

  closeDrawer() {
    this.openCat.set(null);
    this.questions.set([]);
  }

  private async reloadQuestions() {
    const cat = this.openCat();
    if (!cat) return;
    this.loadingQuestions.set(true);
    try {
      const list = await this.admin.questionsInCategory(cat.id);
      this.questions.set(list);
      this.syncCounts(cat.id, list);
    } catch (err: any) {
      this.drawerMsg.set({ type: 'danger', text: `Sorular yüklenemedi: ${err?.message ?? ''}` });
    } finally {
      this.loadingQuestions.set(false);
    }
  }

  /** Keeps the table numbers right after changes in the drawer, without a full recount. */
  private syncCounts(categoryId: string, list: Question[]) {
    const approved = list.filter((q) => q.reviewStatus === 'approved').length;
    const draft = list.filter((q) => q.reviewStatus === 'draft').length;
    const current = this.stats() ?? [];
    const next = current.some((s) => s.categoryId === categoryId)
      ? current.map((s) => (s.categoryId === categoryId ? { categoryId, approved, draft } : s))
      : [...current, { categoryId, approved, draft }];
    this.stats.set(next);
    if (this.admin.cachedPoolStats) this.admin.cachedPoolStats.stats = next;
  }

  private async act(q: Question, fn: () => Promise<void>, ok: string) {
    this.busyId.set(q.id);
    this.drawerMsg.set(null);
    try {
      await fn();
      this.drawerMsg.set({ type: 'success', text: ok });
      await this.reloadQuestions();
    } catch (err: any) {
      this.drawerMsg.set({ type: 'danger', text: `İşlem yapılamadı: ${err?.message ?? ''}` });
    } finally {
      this.busyId.set(null);
    }
  }

  approve(q: Question) {
    this.act(
      q,
      async () => {
        await this.admin.setQuestionStatus(q.id, 'approved');
        this.notifications.recordApprovals([q.id]).catch(() => {});
      },
      'Soru onaylandı ve havuza eklendi.'
    );
  }

  unpublish(q: Question) {
    if (!confirm('Soru yayından kaldırılıp taslağa alınsın mı? Öğrenciler artık görmez.')) return;
    this.act(q, () => this.admin.setQuestionStatus(q.id, 'draft'), 'Soru taslağa alındı.');
  }

  remove(q: Question) {
    if (!confirm('Bu soru kalıcı olarak silinsin mi? Geri alınamaz.')) return;
    this.act(q, () => this.admin.deleteQuestion(q.id), 'Soru silindi.');
  }

  startEdit(q: Question) {
    this.editingId.set(q.id);
    this.editPrompt.set(q.prompt);
    this.editOptions.set(q.options.map((o) => ({ ...o })));
    this.editCorrect.set(q.correctOptionId);
    this.editExplanation.set(q.explanation ?? '');
    this.editDifficulty.set(q.difficulty ?? 2);
    this.editOutcome.set(q.outcomeCode ?? '');
  }

  setOption(id: string, text: string) {
    this.editOptions.update((list) => list.map((o) => (o.id === id ? { ...o, text } : o)));
  }

  saveEdit(q: Question) {
    const prompt = this.editPrompt().trim();
    const options = this.editOptions().map((o) => ({ id: o.id, text: o.text.trim() }));
    if (prompt.length < 5 || options.some((o) => !o.text)) {
      this.drawerMsg.set({ type: 'danger', text: 'Soru kökü ve tüm şıklar dolu olmalı.' });
      return;
    }
    const difficulty = Math.min(5, Math.max(1, Math.round(this.editDifficulty()))) as Question['difficulty'];
    const outcome = this.editOutcome().trim();
    const updates: Partial<Question> = {
      prompt,
      options,
      correctOptionId: this.editCorrect(),
      explanation: this.editExplanation().trim(),
      difficulty,
    };
    if (outcome) updates.outcomeCode = outcome;
    this.act(
      q,
      async () => {
        await this.admin.updateQuestion(q.id, updates);
        this.editingId.set(null);
      },
      'Soru güncellendi.'
    );
  }

  sourceLabel(q: Question): string {
    if (q.source === 'teacher') return `Öğretmen: ${q.authorName || '—'}`;
    if (q.source === 'ai-generated') return 'Yapay zekâ';
    return 'Elle';
  }
}
