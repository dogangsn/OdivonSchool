import { Component, inject, signal, computed, effect, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap, tap } from 'rxjs';
import { AiGeneratorService, DraftCursor, DraftPage } from '../../../core/services/ai-generator';
import { FirestoreService } from '../../../core/services/firestore';
import { NotificationService } from '../../../core/services/notifications';
import { Question } from '../../../models/question';
import { TestCategory } from '../../../models/test-category';

@Component({
  selector: 'app-question-review',
  imports: [FormsModule, RouterLink],
  templateUrl: './question-review.html',
  styleUrl: './question-review.scss',
})
export class QuestionReview implements OnInit {
  aiGen = inject(AiGeneratorService);
  private firestoreSvc = inject(FirestoreService);
  private notifications = inject(NotificationService);

  // All categories from Firestore
  categories = toSignal(this.firestoreSvc.allCategories(), { initialValue: [] });

  // --- Draft pagination (server-side, 20 per page) ---
  readonly pageSize = 20;
  /** Cursors of the pages before the current one; empty on page 1. */
  private cursorStack = signal<DraftCursor[]>([]);
  pageNumber = computed(() => this.cursorStack().length + 1);
  draftTotal = signal(0);
  totalPages = computed(() => Math.max(1, Math.ceil(this.draftTotal() / this.pageSize)));

  private draftPage = toSignal(
    toObservable(this.cursorStack).pipe(
      switchMap((stack) => this.aiGen.draftPage(stack.at(-1) ?? null, this.pageSize)),
      tap(() => this.refreshDraftTotal())
    ),
    { initialValue: { items: [], hasNext: false } as DraftPage }
  );
  draftQuestions = computed(() => this.draftPage().items);
  hasNextPage = computed(() => this.draftPage().hasNext);

  // --- Selection on the current page ---
  selectedIds = signal<ReadonlySet<string>>(new Set());
  selectedCount = computed(() => this.selectedIds().size);
  allOnPageSelected = computed(
    () => this.draftQuestions().length > 0 && this.draftQuestions().every((q) => this.selectedIds().has(q.id))
  );

  /** "3. Sınıf · " for single-grade (MEB tema) categories. */
  gradePrefix(cat: TestCategory): string {
    return cat.grades?.length === 1 ? `${cat.grades[0]}. Sınıf · ` : '';
  }

  // Group categories by educational level for organized optgroups
  ilkokulCategories = computed(() =>
    this.categories().filter((c) => c.level === 'ilkokul')
  );
  ortaokulCategories = computed(() =>
    this.categories().filter((c) => c.level === 'ortaokul')
  );
  liseCategories = computed(() =>
    this.categories().filter((c) => c.level === 'lise')
  );
  kpssCategories = computed(() =>
    this.categories().filter((c) => c.level === 'kpss')
  );

  // Generation form parameters
  selectedCategoryId = signal<string>('ortaokul-matematik-carpanlar-katlar');
  count = signal<number>(5);
  difficulty = signal<number>(2);
  subTopic = signal<string>('');

  generating = signal(false);
  generateMessage = signal<{ type: 'success' | 'danger' | 'info'; text: string } | null>(null);
  reviewingId = signal<string | null>(null);
  bulkApproving = signal(false);
  bulkRejecting = signal(false);
  bulkBusy = computed(() => this.bulkApproving() || this.bulkRejecting());

  // API Key modal / drawer
  showApiKeyModal = signal(false);
  apiKeyInput = signal<string>('');
  keyTesting = signal(false);
  keyMessage = signal<{ type: 'success' | 'danger'; text: string } | null>(null);

  // Edit Question modal
  editingQuestion = signal<Question | null>(null);
  editPrompt = signal('');
  editOptionA = signal('');
  editOptionB = signal('');
  editOptionC = signal('');
  editOptionD = signal('');
  editCorrect = signal<'a' | 'b' | 'c' | 'd'>('a');
  editExplanation = signal('');
  editDifficulty = signal<1 | 2 | 3 | 4 | 5>(2);
  savingEdit = signal(false);

  constructor() {
    // Keep the selection limited to questions still on this page, and step
    // back a page when everything on the current one has been reviewed.
    effect(() => {
      const page = this.draftPage();
      const ids = new Set(page.items.map((q) => q.id));
      const selected = this.selectedIds();
      if ([...selected].some((id) => !ids.has(id))) {
        this.selectedIds.set(new Set([...selected].filter((id) => ids.has(id))));
      }
      if (page.items.length === 0 && this.cursorStack().length > 0) {
        this.cursorStack.update((s) => s.slice(0, -1));
      }
    });
  }

  ngOnInit() {
    this.apiKeyInput.set(this.aiGen.apiKey());
    // Auto-select first available category if default not found
    const cats = this.categories();
    if (cats.length > 0 && !this.selectedCategoryId()) {
      this.selectedCategoryId.set(cats[0].id);
    }
  }

  // --- API Key Management ---
  openApiKeyModal() {
    this.apiKeyInput.set(this.aiGen.apiKey());
    this.keyMessage.set(null);
    this.showApiKeyModal.set(true);
  }

  closeApiKeyModal() {
    this.showApiKeyModal.set(false);
  }

  async saveAndTestApiKey() {
    const key = this.apiKeyInput().trim();
    if (!key) {
      this.keyMessage.set({ type: 'danger', text: 'Lütfen geçerli bir Gemini API anahtarı girin.' });
      return;
    }

    this.keyTesting.set(true);
    this.keyMessage.set(null);
    try {
      const result = await this.aiGen.testApiKey(key);
      if (result.ok) {
        this.aiGen.setApiKey(key);
        this.keyMessage.set({ type: 'success', text: result.message });
        setTimeout(() => {
          this.closeApiKeyModal();
        }, 1200);
      } else {
        this.keyMessage.set({ type: 'danger', text: result.message });
      }
    } finally {
      this.keyTesting.set(false);
    }
  }

  // --- Question Generation ---
  async generate() {
    const catId = this.selectedCategoryId();
    const category = this.categories().find((c) => c.id === catId);
    if (!category) {
      this.generateMessage.set({ type: 'danger', text: 'Lütfen geçerli bir kategori seçin.' });
      return;
    }

    if (!this.aiGen.hasApiKey()) {
      this.openApiKeyModal();
      return;
    }

    this.generating.set(true);
    this.generateMessage.set(null);

    try {
      const questions = await this.aiGen.generateQuestions(
        category,
        this.count(),
        this.difficulty(),
        this.subTopic().trim() || undefined
      );

      this.generateMessage.set({
        type: 'success',
        text: `✔ Başarılı: Gemini 3.8 Flash tarafından ${questions.length} adet soru üretildi ve onay havuzuna eklendi!`,
      });
      this.refreshDraftTotal();
    } catch (err: any) {
      this.generateMessage.set({
        type: 'danger',
        text: `Hata: ${err?.message ?? 'Soru üretimi sırasında bir sorun oluştu.'}`,
      });
    } finally {
      this.generating.set(false);
    }
  }

  // --- Review Actions ---
  async approve(questionId: string) {
    this.reviewingId.set(questionId);
    try {
      await this.aiGen.approveQuestion(questionId);
      this.notifyStudents([questionId]);
    } catch (err: any) {
      alert(`Onaylama hatası: ${err.message}`);
    } finally {
      this.reviewingId.set(null);
      this.refreshDraftTotal();
    }
  }

  async reject(questionId: string) {
    if (!confirm('Bu taslak soruyu silmek istediğinizden emin misiniz?')) return;
    this.reviewingId.set(questionId);
    try {
      await this.aiGen.rejectQuestion(questionId);
    } catch (err: any) {
      alert(`Silme hatası: ${err.message}`);
    } finally {
      this.reviewingId.set(null);
      this.refreshDraftTotal();
    }
  }

  /** Tells students of the affected sınıflar that new questions arrived. */
  private notifyStudents(ids: string[]) {
    this.notifications.recordApprovals(ids).catch((err) => {
      // The questions are already live; a missed notice is not worth an error dialog.
      console.warn('[QuestionReview] pool update notice failed:', err);
    });
  }

  // --- Pagination ---
  nextPage() {
    const last = this.draftQuestions().at(-1);
    if (!last || !this.hasNextPage()) return;
    this.selectedIds.set(new Set());
    this.cursorStack.update((s) => [...s, { createdAt: last.createdAt ?? 0, id: last.id }]);
  }

  prevPage() {
    if (this.cursorStack().length === 0) return;
    this.selectedIds.set(new Set());
    this.cursorStack.update((s) => s.slice(0, -1));
  }

  firstPage() {
    this.selectedIds.set(new Set());
    this.cursorStack.set([]);
  }

  private async refreshDraftTotal() {
    try {
      this.draftTotal.set(await this.aiGen.draftCount());
    } catch {
      // Count is informational; keep the last known value.
    }
  }

  // --- Selection ---
  isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  toggleSelect(id: string) {
    const next = new Set(this.selectedIds());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.selectedIds.set(next);
  }

  toggleSelectPage() {
    this.selectedIds.set(
      this.allOnPageSelected() ? new Set() : new Set(this.draftQuestions().map((q) => q.id))
    );
  }

  // --- Bulk Actions ---
  async bulkApproveSelected() {
    const ids = [...this.selectedIds()];
    if (ids.length === 0) return;
    if (!confirm(`Seçili ${ids.length} soruyu onaylayıp canlıya almak istiyor musunuz?`)) return;

    this.bulkApproving.set(true);
    try {
      await this.aiGen.bulkApprove(ids);
      this.notifyStudents(ids);
      this.selectedIds.set(new Set());
      this.generateMessage.set({
        type: 'success',
        text: `✔ Seçili ${ids.length} soru onaylandı ve öğrencilerin havuzuna eklendi!`,
      });
    } catch (err: any) {
      alert(`Toplu onay hatası: ${err.message}`);
    } finally {
      this.bulkApproving.set(false);
      this.refreshDraftTotal();
    }
  }

  async bulkRejectSelected() {
    const ids = [...this.selectedIds()];
    if (ids.length === 0) return;
    if (!confirm(`Seçili ${ids.length} taslak soruyu silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`)) return;

    this.bulkRejecting.set(true);
    try {
      await this.aiGen.bulkReject(ids);
      this.selectedIds.set(new Set());
      this.generateMessage.set({ type: 'info', text: `Seçili ${ids.length} taslak soru silindi.` });
    } catch (err: any) {
      alert(`Toplu silme hatası: ${err.message}`);
    } finally {
      this.bulkRejecting.set(false);
      this.refreshDraftTotal();
    }
  }

  async bulkApproveAll() {
    this.bulkApproving.set(true);
    try {
      const ids = await this.aiGen.allDraftIds();
      if (ids.length === 0) return;
      if (!confirm(`Onay bekleyen ${ids.length} sorunun tamamını (tüm sayfalar) onaylayıp canlıya almak istiyor musunuz?`)) return;

      await this.aiGen.bulkApprove(ids);
      this.notifyStudents(ids);
      this.selectedIds.set(new Set());
      this.cursorStack.set([]);
      this.generateMessage.set({
        type: 'success',
        text: `✔ Tüm sorular (${ids.length} adet) başarıyla onaylandı ve öğrencilerin havuzuna eklendi!`,
      });
    } catch (err: any) {
      alert(`Toplu onay hatası: ${err.message}`);
    } finally {
      this.bulkApproving.set(false);
      this.refreshDraftTotal();
    }
  }

  setEditDifficulty(val: number) {
    const clamped = Math.min(Math.max(val, 1), 5) as 1 | 2 | 3 | 4 | 5;
    this.editDifficulty.set(clamped);
  }

  // --- Edit Question Modal ---
  openEdit(q: Question) {
    this.editingQuestion.set(q);
    this.editPrompt.set(q.prompt);
    this.editOptionA.set(q.options.find((o) => o.id === 'a')?.text || '');
    this.editOptionB.set(q.options.find((o) => o.id === 'b')?.text || '');
    this.editOptionC.set(q.options.find((o) => o.id === 'c')?.text || '');
    this.editOptionD.set(q.options.find((o) => o.id === 'd')?.text || '');
    this.editCorrect.set((q.correctOptionId as 'a' | 'b' | 'c' | 'd') || 'a');
    this.editExplanation.set(q.explanation || '');
    this.editDifficulty.set(q.difficulty || 2);
  }

  closeEdit() {
    this.editingQuestion.set(null);
  }

  async saveEdit() {
    const q = this.editingQuestion();
    if (!q) return;

    this.savingEdit.set(true);
    try {
      const updatedOptions = [
        { id: 'a', text: this.editOptionA().trim() },
        { id: 'b', text: this.editOptionB().trim() },
        { id: 'c', text: this.editOptionC().trim() },
        { id: 'd', text: this.editOptionD().trim() },
      ];

      await this.aiGen.updateQuestion(q.id, {
        prompt: this.editPrompt().trim(),
        options: updatedOptions,
        correctOptionId: this.editCorrect(),
        explanation: this.editExplanation().trim(),
        difficulty: this.editDifficulty(),
      });

      this.closeEdit();
    } catch (err: any) {
      alert(`Güncelleme hatası: ${err.message}`);
    } finally {
      this.savingEdit.set(false);
    }
  }
}
