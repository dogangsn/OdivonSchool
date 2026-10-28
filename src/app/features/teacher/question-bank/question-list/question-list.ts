import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { of, switchMap } from 'rxjs';
import { AuthService } from '../../../../core/services/auth';
import { QuestionBankService } from '../../../../core/services/question-bank';
import { FirestoreService } from '../../../../core/services/firestore';
import { TestCategory } from '../../../../models/test-category';
import {
  OPTION_LETTERS,
  POOL_STATE_LABELS,
  PoolState,
  TeacherQuestion,
  poolIdFor,
} from '../../../../models/teacher-question';
import { Question } from '../../../../models/question';
import { findDuplicate, passesPool, poolCriteria } from '../../../../core/question-criteria';

/** /ogretmen/sorular — the teacher's own questions and their pool status. */
@Component({
  selector: 'app-question-list',
  imports: [RouterLink],
  templateUrl: './question-list.html',
  styleUrl: './question-list.scss',
})
export class QuestionList {
  private auth = inject(AuthService);
  private bank = inject(QuestionBankService);
  private firestoreSvc = inject(FirestoreService);

  readonly letters = OPTION_LETTERS;
  readonly stateLabels = POOL_STATE_LABELS;

  questions = toSignal(
    this.auth.appUser$.pipe(switchMap((u) => (u ? this.bank.myQuestions(u.uid) : of([]))))
  );
  private poolCopies = toSignal(
    this.auth.appUser$.pipe(switchMap((u) => (u ? this.bank.myPoolCopies(u.uid) : of([])))),
    { initialValue: [] as Question[] }
  );
  private categories = toSignal(this.firestoreSvc.allCategories(), { initialValue: [] as TestCategory[] });

  gradeFilter = signal<number | null>(null);
  subjectFilter = signal<string | null>(null);
  stateFilter = signal<PoolState | null>(null);
  openId = signal<string | null>(null);
  busyId = signal<string | null>(null);
  notice = signal<{ type: 'success' | 'danger'; text: string } | null>(null);

  private copyById = computed(() => new Map(this.poolCopies().map((q) => [q.id, q])));

  grades = computed(() => [...new Set((this.questions() ?? []).map((q) => q.grade))].sort((a, b) => a - b));
  subjects = computed(() => [...new Set((this.questions() ?? []).map((q) => q.subject))].sort());

  filtered = computed(() =>
    (this.questions() ?? []).filter(
      (q) =>
        (this.gradeFilter() === null || q.grade === this.gradeFilter()) &&
        (this.subjectFilter() === null || q.subject === this.subjectFilter()) &&
        (this.stateFilter() === null || this.state(q) === this.stateFilter())
    )
  );

  stats = computed(() => {
    const list = this.questions() ?? [];
    return {
      total: list.length,
      pending: list.filter((q) => this.state(q) === 'pending').length,
      approved: list.filter((q) => this.state(q) === 'approved').length,
    };
  });

  state(q: TeacherQuestion): PoolState {
    const copy = this.copyById().get(poolIdFor(q.id));
    if (copy) return copy.reviewStatus === 'approved' ? 'approved' : 'pending';
    return q.poolSubmittedAt ? 'removed' : 'none';
  }

  toggle(id: string) {
    this.openId.set(this.openId() === id ? null : id);
  }

  async offer(q: TeacherQuestion) {
    this.notice.set(null);
    const category = this.categories().find((c) => c.id === q.categoryId) ?? null;
    this.busyId.set(q.id);
    try {
      const pool = await this.bank.approvedForCategory(q.categoryId).catch(() => [] as Question[]);
      const results = poolCriteria(q, category, findDuplicate(q.prompt, pool));
      if (!passesPool(results)) {
        const missing = results.filter((r) => !r.ok).map((r) => r.label.toLocaleLowerCase('tr'));
        this.notice.set({
          type: 'danger',
          text: `Havuz kriterleri eksik: ${missing.join(', ')}. Soruyu düzenleyip tekrar deneyin.`,
        });
        return;
      }
      await this.bank.submitToPool(q);
      this.notice.set({ type: 'success', text: 'Soru onay için havuza gönderildi.' });
    } catch (err: any) {
      this.notice.set({ type: 'danger', text: `Gönderilemedi: ${err?.message ?? err}` });
    } finally {
      this.busyId.set(null);
    }
  }

  async withdraw(q: TeacherQuestion) {
    if (!confirm('Havuza önerinizi geri çekmek istiyor musunuz? Soru bankanızda kalır.')) return;
    this.busyId.set(q.id);
    try {
      await this.bank.withdrawFromPool(q);
    } catch (err: any) {
      this.notice.set({ type: 'danger', text: `Geri çekilemedi: ${err?.message ?? err}` });
    } finally {
      this.busyId.set(null);
    }
  }

  async remove(q: TeacherQuestion) {
    const state = this.state(q);
    const extra = state === 'approved' ? ' Ortak havuzdaki onaylı kopyası yerinde kalır.' : '';
    if (!confirm(`Bu soru bankanızdan silinsin mi?${extra}`)) return;
    this.busyId.set(q.id);
    try {
      await this.bank.deleteQuestion(q, state);
    } catch (err: any) {
      this.notice.set({ type: 'danger', text: `Silinemedi: ${err?.message ?? err}` });
    } finally {
      this.busyId.set(null);
    }
  }
}
