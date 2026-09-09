import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AiGeneratorService } from '../../../core/services/ai-generator';
import { FirestoreService } from '../../../core/services/firestore';
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

  // All categories from Firestore
  categories = toSignal(this.firestoreSvc.allCategories(), { initialValue: [] });

  // Real-time draft questions from Firestore
  draftQuestions = toSignal(this.aiGen.draftQuestions(), { initialValue: [] });

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
        text: `✔ Başarılı: Gemini 2.0 Flash tarafından ${questions.length} adet soru üretildi ve onay havuzuna eklendi!`,
      });
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
    } catch (err: any) {
      alert(`Onaylama hatası: ${err.message}`);
    } finally {
      this.reviewingId.set(null);
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
    }
  }

  async bulkApproveAll() {
    const drafts = this.draftQuestions();
    if (drafts.length === 0) return;
    if (!confirm(`Onay bekleyen ${drafts.length} sorunun tamamını onaylayıp canlıya almak istiyor musunuz?`)) return;

    this.bulkApproving.set(true);
    try {
      const ids = drafts.map((q) => q.id);
      await this.aiGen.bulkApprove(ids);
      this.generateMessage.set({
        type: 'success',
        text: `✔ Tüm sorular (${ids.length} adet) başarıyla onaylandı ve öğrencilerin havuzuna eklendi!`,
      });
    } catch (err: any) {
      alert(`Toplu onay hatası: ${err.message}`);
    } finally {
      this.bulkApproving.set(false);
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
