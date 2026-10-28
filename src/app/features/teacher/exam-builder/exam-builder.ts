import { Component, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { of, switchMap } from 'rxjs';
import { AuthService } from '../../../core/services/auth';
import { ClassroomService } from '../../../core/services/classroom';
import { FirestoreService } from '../../../core/services/firestore';
import {
  ExamItem,
  QuestionBankService,
  bankItem,
  poolItem,
} from '../../../core/services/question-bank';
import { Classroom } from '../../../models/classroom';
import { TestCategory } from '../../../models/test-category';
import {
  EXAM_DURATIONS,
  EXAM_MAX_QUESTIONS,
  OPTION_LETTERS,
  TeacherQuestion,
} from '../../../models/teacher-question';
import { categoriesForGrade, subjectsOf } from '../../../core/question-criteria';

type Source = 'bank' | 'pool';

/** /ogretmen/sinav/yeni?sinif=<classId> — builds an exam and gives it to classes. */
@Component({
  selector: 'app-exam-builder',
  imports: [FormsModule, RouterLink],
  templateUrl: './exam-builder.html',
  styleUrl: './exam-builder.scss',
})
export class ExamBuilder implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(AuthService);
  private classroomSvc = inject(ClassroomService);
  private firestoreSvc = inject(FirestoreService);
  private bank = inject(QuestionBankService);

  readonly letters = OPTION_LETTERS;
  readonly durations = EXAM_DURATIONS;
  readonly maxQuestions = EXAM_MAX_QUESTIONS;
  readonly grades = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  classes = toSignal(
    this.auth.appUser$.pipe(switchMap((u) => (u ? this.classroomSvc.myClasses(u.uid) : of([]))))
  );
  activeClasses = computed(() => (this.classes() ?? []).filter((c) => !c.archived));
  bankQuestions = toSignal(
    this.auth.appUser$.pipe(switchMap((u) => (u ? this.bank.myQuestions(u.uid) : of([])))),
    { initialValue: [] as TeacherQuestion[] }
  );
  private allCategories = toSignal(this.firestoreSvc.allCategories(), { initialValue: [] as TestCategory[] });

  // --- exam settings ---
  classIds = signal<ReadonlySet<string>>(new Set());
  title = '';
  dueDate = '';
  timeLimitMin = signal(40);
  showAnswers = signal(true);
  shuffle = signal(false);

  // --- picker ---
  source = signal<Source>('bank');
  grade = signal(3);
  subject = signal<string | null>(null);
  categoryId = signal('');
  poolItems = signal<ExamItem[] | null>(null);
  poolLoading = signal(false);

  items = signal<ExamItem[]>([]);
  selectedRefs = computed(() => new Set(this.items().map((i) => i.ref)));

  saving = signal(false);
  errors = signal<string[]>([]);

  gradeCategories = computed(() => categoriesForGrade(this.allCategories(), this.grade()));
  subjects = computed(() => subjectsOf(this.gradeCategories()));
  topics = computed(() => this.gradeCategories().filter((c) => c.subject === this.subject()));

  bankFiltered = computed(() =>
    this.bankQuestions().filter(
      (q) =>
        q.grade === this.grade() &&
        (this.subject() === null || q.subject === this.subject()) &&
        (!this.categoryId() || q.categoryId === this.categoryId())
    )
  );
  bankSubjects = computed(() => [
    ...new Set(this.bankQuestions().filter((q) => q.grade === this.grade()).map((q) => q.subject)),
  ]);

  mainSubject = computed(() => {
    const counts = new Map<string, number>();
    for (const i of this.items()) counts.set(i.question.subject, (counts.get(i.question.subject) ?? 0) + 1);
    if (counts.size === 0) return '';
    if (counts.size > 1) return 'Karma';
    return [...counts.keys()][0];
  });

  private defaultsApplied = false;

  constructor() {
    // Once classes arrive: preselect the only class and match the picker's grade.
    effect(() => {
      const list = this.classes();
      if (list === undefined || this.defaultsApplied) return;
      this.defaultsApplied = true;
      untracked(() => {
        const active = list.filter((c) => !c.archived);
        if (this.classIds().size === 0 && active.length === 1) this.classIds.set(new Set([active[0].id]));
        const first = list.find((c) => this.classIds().has(c.id)) ?? active[0];
        if (first?.grade) this.grade.set(first.grade);
      });
    });
  }

  ngOnInit() {
    const classId = this.route.snapshot.queryParamMap.get('sinif');
    if (classId) this.classIds.set(new Set([classId]));
  }

  toggleClass(id: string) {
    const next = new Set(this.classIds());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.classIds.set(next);
  }

  // --- picker ---
  chooseSource(s: Source) {
    this.source.set(s);
    if (s === 'pool' && this.categoryId()) void this.loadPool();
  }

  chooseGrade(g: number) {
    this.grade.set(g);
    this.subject.set(null);
    this.categoryId.set('');
    this.poolItems.set(null);
  }

  chooseSubject(s: string | null) {
    this.subject.set(s);
    this.categoryId.set('');
    this.poolItems.set(null);
  }

  chooseTopic(id: string) {
    this.categoryId.set(id);
    if (this.source() === 'pool') void this.loadPool();
  }

  private async loadPool() {
    const id = this.categoryId();
    if (!id) return;
    const topic = this.allCategories().find((c) => c.id === id)?.topic ?? null;
    this.poolLoading.set(true);
    try {
      const list = await this.bank.approvedForCategory(id);
      if (this.categoryId() === id) this.poolItems.set(list.map((q) => poolItem(q, topic)));
    } catch {
      this.poolItems.set([]);
    } finally {
      this.poolLoading.set(false);
    }
  }

  addBank(q: TeacherQuestion) {
    this.add(bankItem(q));
  }

  add(item: ExamItem) {
    if (this.selectedRefs().has(item.ref) || this.items().length >= EXAM_MAX_QUESTIONS) return;
    this.items.update((list) => [...list, item]);
  }

  addAllVisible() {
    const list = this.source() === 'bank' ? this.bankFiltered().map(bankItem) : (this.poolItems() ?? []);
    for (const item of list) this.add(item);
  }

  remove(i: number) {
    this.items.update((list) => list.filter((_, j) => j !== i));
  }

  move(i: number, delta: number) {
    const j = i + delta;
    this.items.update((list) => {
      if (j < 0 || j >= list.length) return list;
      const copy = [...list];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  }

  // --- save ---
  async save() {
    const errs: string[] = [];
    if (this.classIds().size === 0) errs.push('Sınavı vereceğiniz en az bir sınıf seçin.');
    if (!this.title.trim()) errs.push('Sınava bir başlık verin.');
    if (this.items().length === 0) errs.push('Sınava en az bir soru ekleyin.');
    this.errors.set(errs);
    if (errs.length) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const classIds = [...this.classIds()];
    this.saving.set(true);
    try {
      await this.bank.createExam(classIds, {
        title: this.title.trim(),
        subject: this.mainSubject(),
        dueAt: this.dueDate ? new Date(`${this.dueDate}T23:59:00`).getTime() : null,
        timeLimitMin: this.timeLimitMin(),
        showAnswers: this.showAnswers(),
        shuffle: this.shuffle(),
        items: this.items(),
      });
      if (classIds.length === 1) this.router.navigate(['/ogretmen/sinif', classIds[0]], { queryParams: { sekme: 'odevler' } });
      else this.router.navigateByUrl('/ogretmen');
    } catch (err: any) {
      this.errors.set([`Sınav kaydedilemedi: ${err?.message ?? err}`]);
    } finally {
      this.saving.set(false);
    }
  }
}
