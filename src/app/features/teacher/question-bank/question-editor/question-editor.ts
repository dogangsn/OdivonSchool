import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom, take } from 'rxjs';
import { FirestoreService } from '../../../../core/services/firestore';
import { QuestionBankService } from '../../../../core/services/question-bank';
import { AuthService } from '../../../../core/services/auth';
import { TestCategory, levelForGrade } from '../../../../models/test-category';
import {
  OPTION_LETTERS,
  TeacherQuestion,
  TeacherQuestionDraft,
} from '../../../../models/teacher-question';
import {
  CriterionResult,
  categoriesForGrade,
  findDuplicate,
  passesPool,
  poolCriteria,
  subjectsOf,
  validateQuestion,
} from '../../../../core/question-criteria';

const LAST_KEY = 'odv-soru-bankasi-son';
const DIFFICULTIES: { value: 1 | 2 | 3 | 4 | 5; label: string }[] = [
  { value: 1, label: 'Çok kolay' },
  { value: 2, label: 'Kolay' },
  { value: 3, label: 'Orta' },
  { value: 4, label: 'Zor' },
  { value: 5, label: 'Çok zor' },
];

interface LastChoice {
  grade: number;
  subject: string;
  categoryId: string;
}

function readLast(): LastChoice | null {
  try {
    const raw = localStorage.getItem(LAST_KEY);
    return raw ? (JSON.parse(raw) as LastChoice) : null;
  } catch {
    return null;
  }
}

function writeLast(c: LastChoice) {
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify(c));
  } catch {
    // Remembering the last konu is only a convenience.
  }
}

/** /ogretmen/sorular/yeni and /ogretmen/sorular/:id */
@Component({
  selector: 'app-question-editor',
  imports: [FormsModule, RouterLink],
  templateUrl: './question-editor.html',
  styleUrl: './question-editor.scss',
})
export class QuestionEditor implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(AuthService);
  private firestoreSvc = inject(FirestoreService);
  private bank = inject(QuestionBankService);

  readonly grades = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  readonly letters = OPTION_LETTERS;
  readonly difficulties = DIFFICULTIES;

  private allCategories = toSignal(this.firestoreSvc.allCategories(), { initialValue: [] as TestCategory[] });

  existing = signal<TeacherQuestion | null>(null);
  loading = signal(true);
  saving = signal(false);
  errors = signal<string[]>([]);
  notice = signal<string | null>(null);
  savedCount = signal(0);

  grade = signal(3);
  subject = signal('');
  categoryId = signal('');
  outcomeCode = signal<string | null>(null);
  prompt = signal('');
  options = signal<string[]>(['', '', '', '']);
  correctIndex = signal(0);
  explanation = signal('');
  difficulty = signal<1 | 2 | 3 | 4 | 5>(2);
  sendToPool = signal(true);

  /** Approved pool questions of the chosen konu, for the duplicate check. */
  private poolInTopic = signal<{ prompt: string }[]>([]);
  private poolLoadedFor = '';

  gradeCategories = computed(() => categoriesForGrade(this.allCategories(), this.grade()));
  subjects = computed(() => subjectsOf(this.gradeCategories()));
  topics = computed(() => this.gradeCategories().filter((c) => c.subject === this.subject()));
  category = computed(() => this.allCategories().find((c) => c.id === this.categoryId()) ?? null);
  outcomes = computed(() => this.category()?.outcomes ?? []);

  private draft = computed<TeacherQuestionDraft>(() => {
    const cat = this.category();
    const outcome = this.outcomes().find((o) => o.code === this.outcomeCode()) ?? null;
    return {
      grade: this.grade(),
      level: cat?.level ?? levelForGrade(this.grade()),
      subject: this.subject(),
      categoryId: this.categoryId(),
      topic: cat?.topic ?? '',
      outcomeCode: outcome?.code ?? null,
      outcomeText: outcome?.text ?? null,
      prompt: this.prompt(),
      options: this.options(),
      correctIndex: this.correctIndex(),
      explanation: this.explanation(),
      difficulty: this.difficulty(),
    };
  });

  duplicate = computed(() =>
    this.prompt().trim().length >= 10 ? findDuplicate(this.prompt(), this.poolInTopic()) : null
  );
  criteria = computed<CriterionResult[]>(() => poolCriteria(this.draft(), this.category(), this.duplicate()));
  poolReady = computed(() => passesPool(this.criteria()));
  /** Already offered: edits stay in the bank, the pool copy is not changed. */
  alreadyPooled = computed(() => !!this.existing()?.poolSubmittedAt);

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'yeni') {
      const q = await this.bank.questionById(id).catch(() => null);
      if (q) {
        this.existing.set(q);
        this.grade.set(q.grade);
        this.subject.set(q.subject);
        this.categoryId.set(q.categoryId);
        this.outcomeCode.set(q.outcomeCode);
        this.prompt.set(q.prompt);
        this.options.set([...q.options]);
        this.correctIndex.set(q.correctIndex);
        this.explanation.set(q.explanation);
        this.difficulty.set(q.difficulty);
        this.sendToPool.set(false);
      }
    } else {
      const qp = this.route.snapshot.queryParamMap;
      const last = readLast();
      const grade = Number(qp.get('sinif')) || last?.grade || (await this.defaultGrade());
      this.grade.set(grade);
      if (last && last.grade === grade) {
        this.subject.set(last.subject);
        this.categoryId.set(last.categoryId);
      }
    }
    this.loading.set(false);
    void this.loadPoolForTopic();
  }

  private async defaultGrade(): Promise<number> {
    const user = await firstValueFrom(this.auth.appUser$.pipe(take(1)));
    return user?.grade && user.grade >= 1 ? user.grade : 3;
  }

  // --- curriculum pickers ---
  chooseGrade(g: number) {
    if (g === this.grade()) return;
    this.grade.set(g);
    this.subject.set('');
    this.categoryId.set('');
    this.outcomeCode.set(null);
  }

  chooseSubject(s: string) {
    if (s === this.subject()) return;
    this.subject.set(s);
    this.categoryId.set('');
    this.outcomeCode.set(null);
  }

  chooseTopic(id: string) {
    this.categoryId.set(id);
    const outs = this.category()?.outcomes ?? [];
    this.outcomeCode.set(outs.length === 1 ? outs[0].code : null);
    void this.loadPoolForTopic();
  }

  topicLabel(c: TestCategory): string {
    return c.outcomes?.length ? `${c.topic}` : `${c.topic} (genel)`;
  }

  private async loadPoolForTopic() {
    const id = this.categoryId();
    if (!id || id === this.poolLoadedFor) return;
    this.poolLoadedFor = id;
    try {
      const list = await this.bank.approvedForCategory(id);
      // Don't flag the question as a copy of its own pool version.
      const own = this.existing() ? `t_${this.existing()!.id}` : '';
      if (this.categoryId() === id) this.poolInTopic.set(list.filter((q) => q.id !== own));
    } catch {
      this.poolInTopic.set([]);
    }
  }

  setOption(i: number, value: string) {
    this.options.update((list) => list.map((o, j) => (j === i ? value : o)));
  }

  // --- save ---
  async save(andNew = false) {
    this.notice.set(null);
    const draft = this.draft();
    const errs = validateQuestion(draft);
    const wantsPool = this.sendToPool() && !this.alreadyPooled();
    if (wantsPool && !this.poolReady()) {
      errs.push(
        'Ortak havuza önermek için sağdaki kriterlerin hepsi tamam olmalı. İsterseniz "havuza öner" kutusunu kaldırıp yalnızca bankanıza kaydedin.'
      );
    }
    this.errors.set(errs);
    if (errs.length) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    this.saving.set(true);
    try {
      const saved = await this.bank.saveQuestion(draft, this.existing()?.id);
      writeLast({ grade: draft.grade, subject: draft.subject, categoryId: draft.categoryId });
      let pooled = false;
      if (wantsPool) {
        try {
          await this.bank.submitToPool(saved);
          pooled = true;
        } catch (err: any) {
          this.errors.set([`Soru bankanıza kaydedildi ama havuza gönderilemedi: ${err?.message ?? err}`]);
          this.saving.set(false);
          return;
        }
      }
      this.savedCount.update((n) => n + 1);
      if (andNew) {
        this.existing.set(null);
        this.prompt.set('');
        this.options.set(['', '', '', '']);
        this.correctIndex.set(0);
        this.explanation.set('');
        this.notice.set(
          pooled
            ? '✓ Kaydedildi ve onay için havuza gönderildi. Aynı konuda yeni soruya geçtiniz.'
            : '✓ Kaydedildi. Aynı konuda yeni soruya geçtiniz.'
        );
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (this.router.url !== '/ogretmen/sorular/yeni') {
          this.router.navigateByUrl('/ogretmen/sorular/yeni', { replaceUrl: true });
        }
      } else {
        this.router.navigateByUrl('/ogretmen/sorular');
      }
    } catch (err: any) {
      this.errors.set([`Kaydedilemedi: ${err?.message ?? err}`]);
    } finally {
      this.saving.set(false);
    }
  }
}
