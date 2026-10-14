import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ClassroomService } from '../../../core/services/classroom';
import { MatchPair, QuizItem, SUBJECTS, TeacherContentType } from '../../../models/classroom';
import { Question } from '../../../models/question';
import { MatchSet } from '../../../games/match-sets';
import {
  pairsToMatchSet,
  quizItemsToQuestions,
  validatePairs,
  validateQuizItems,
} from '../../../games/teacher-games';
import { Quiz } from '../../games/quiz/quiz';
import { MemoryMatch } from '../../games/memory-match/memory-match';

const MAX_QUESTIONS = 30;
const MAX_PAIRS = 12;
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 5;
const LETTERS = ['A', 'B', 'C', 'D', 'E'];

function emptyItem(): QuizItem {
  return { prompt: '', options: ['', '', '', ''], correctIndex: 0, explanation: '' };
}

/** /ogretmen/icerik/yeni?tur=quiz|match and /ogretmen/icerik/:id */
@Component({
  selector: 'app-content-editor',
  imports: [FormsModule, RouterLink, Quiz, MemoryMatch],
  templateUrl: './content-editor.html',
  styleUrl: './content-editor.scss',
})
export class ContentEditor implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private classroom = inject(ClassroomService);

  readonly subjects = SUBJECTS;
  readonly grades = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  readonly letters = LETTERS;
  readonly maxQuestions = MAX_QUESTIONS;
  readonly maxPairs = MAX_PAIRS;
  readonly maxOptions = MAX_OPTIONS;
  readonly minOptions = MIN_OPTIONS;

  id: string | null = null;
  type = signal<TeacherContentType>('quiz');
  loading = signal(true);
  saving = signal(false);
  errors = signal<string[]>([]);

  title = '';
  subject = signal('Matematik');
  grade = signal(3);
  items: QuizItem[] = [emptyItem()];
  pairs: MatchPair[] = [
    { a: '', b: '' },
    { a: '', b: '' },
    { a: '', b: '' },
  ];

  previewQuestions = signal<Question[] | null>(null);
  previewSet = signal<MatchSet | null>(null);

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'yeni') {
      const content = await this.classroom.contentById(id).catch(() => null);
      if (content) {
        this.id = content.id;
        this.type.set(content.type);
        this.title = content.title;
        this.subject.set(content.subject);
        this.grade.set(content.grade);
        if (content.quizItems?.length) this.items = content.quizItems.map((q) => ({ ...q, options: [...q.options] }));
        if (content.pairs?.length) this.pairs = content.pairs.map((p) => ({ ...p }));
      }
    } else {
      this.type.set(this.route.snapshot.queryParamMap.get('tur') === 'match' ? 'match' : 'quiz');
    }
    this.loading.set(false);
  }

  // --- quiz ---
  addQuestion() {
    if (this.items.length < MAX_QUESTIONS) this.items.push(emptyItem());
  }

  removeQuestion(i: number) {
    if (this.items.length > 1) this.items.splice(i, 1);
  }

  addOption(item: QuizItem) {
    if (item.options.length < MAX_OPTIONS) item.options.push('');
  }

  removeOption(item: QuizItem, j: number) {
    if (item.options.length <= MIN_OPTIONS) return;
    item.options.splice(j, 1);
    if (item.correctIndex >= item.options.length) item.correctIndex = 0;
    else if (item.correctIndex > j) item.correctIndex--;
  }

  // --- match ---
  addPair() {
    if (this.pairs.length < MAX_PAIRS) this.pairs.push({ a: '', b: '' });
  }

  removePair(i: number) {
    if (this.pairs.length > 3) this.pairs.splice(i, 1);
  }

  // --- preview & save ---
  private cleanedItems(): QuizItem[] {
    return this.items.map((q) => ({
      prompt: q.prompt.trim(),
      options: q.options.map((o) => o.trim()),
      correctIndex: q.correctIndex,
      explanation: q.explanation.trim(),
    }));
  }

  private cleanedPairs(): MatchPair[] {
    return this.pairs.map((p) => ({ a: p.a.trim(), b: p.b.trim() }));
  }

  private validate(): boolean {
    const errs: string[] = [];
    if (!this.title.trim()) errs.push('İçeriğe bir başlık verin.');
    errs.push(...(this.type() === 'quiz' ? validateQuizItems(this.cleanedItems()) : validatePairs(this.cleanedPairs())));
    this.errors.set(errs);
    if (errs.length) window.scrollTo({ top: 0, behavior: 'smooth' });
    return errs.length === 0;
  }

  preview() {
    if (!this.validate()) return;
    if (this.type() === 'quiz') {
      this.previewQuestions.set(quizItemsToQuestions(this.cleanedItems(), this.subject(), 'onizleme'));
    } else {
      this.previewSet.set(pairsToMatchSet('onizleme', this.title.trim(), this.subject(), this.cleanedPairs()));
    }
  }

  closePreview() {
    this.previewQuestions.set(null);
    this.previewSet.set(null);
  }

  async save() {
    if (!this.validate()) return;
    this.saving.set(true);
    try {
      await this.classroom.saveContent(
        {
          type: this.type(),
          title: this.title.trim(),
          subject: this.subject(),
          grade: this.grade(),
          quizItems: this.type() === 'quiz' ? this.cleanedItems() : undefined,
          pairs: this.type() === 'match' ? this.cleanedPairs() : undefined,
        },
        this.id ?? undefined
      );
      this.router.navigateByUrl('/ogretmen/icerik');
    } catch (err: any) {
      this.errors.set([`Kaydedilemedi: ${err?.message ?? err}`]);
    } finally {
      this.saving.set(false);
    }
  }
}
