import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom, of, switchMap } from 'rxjs';
import { AuthService } from '../../../core/services/auth';
import { FirestoreService } from '../../../core/services/firestore';
import { GameProgressService } from '../../../core/services/game-progress';
import { LearningService, answeredPool } from '../../../core/services/learning';
import {
  MASTERY_LABELS,
  dueCards,
  outcomeKey,
  outcomeMastery,
  weakestOutcomes,
} from '../../../core/learning';
import { OutcomeMastery, OutcomeStat, ReviewCard } from '../../../models/learning';
import { Question } from '../../../models/question';
import { TestCategory, levelForGrade } from '../../../models/test-category';
import { GameMistake, GameReward } from '../../../games/game-models';
import { quizStars } from '../../../games/scoring';
import { sfx } from '../../../games/sound';
import { shuffled } from '../../../games/math-generator';

const PRACTICE_SIZE = 5;

interface OutcomeCell {
  code: string;
  text: string;
  categoryId: string;
  mastery: OutcomeMastery;
  correct: number;
  total: number;
}

interface SubjectMap {
  subject: string;
  topics: { category: TestCategory; cells: OutcomeCell[] }[];
}

type Mode = 'home' | 'loading' | 'play' | 'done';

/** /tekrar — today's review, practice for weak kazanımlar and the kazanım haritası. */
@Component({
  selector: 'app-smart-review',
  imports: [RouterLink],
  templateUrl: './smart-review.html',
  styleUrl: './smart-review.scss',
})
export class SmartReview {
  private auth = inject(AuthService);
  private firestoreSvc = inject(FirestoreService);
  private learning = inject(LearningService);
  private progress = inject(GameProgressService);

  readonly masteryLabels = MASTERY_LABELS;
  readonly legend: OutcomeMastery[] = ['mastered', 'learning', 'weak', 'none'];

  user = toSignal(this.auth.appUser$, { initialValue: null });
  private uid$ = this.auth.appUser$;
  cards = toSignal(this.uid$.pipe(switchMap((u) => (u ? this.learning.cards(u.uid) : of([])))), {
    initialValue: [] as ReviewCard[],
  });
  stats = toSignal(this.uid$.pipe(switchMap((u) => (u ? this.learning.outcomeStats(u.uid) : of([])))), {
    initialValue: [] as OutcomeStat[],
  });
  private grade = computed(() => this.user()?.grade || 0);
  private categoriesAll = toSignal(
    toObservable(this.grade).pipe(
      switchMap((g) => (g ? this.firestoreSvc.categoriesByLevel(levelForGrade(g)) : of([] as TestCategory[])))
    ),
    { initialValue: [] as TestCategory[] }
  );
  categories = computed(() => {
    const g = this.grade();
    return this.categoriesAll().filter((c) => !c.grades?.length || c.grades.includes(g));
  });

  private now = Date.now();
  due = computed(() => dueCards(this.cards(), this.now));
  nextDue = computed(() => {
    const later = this.cards().filter((c) => c.dueAt > this.now).sort((a, b) => a.dueAt - b.dueAt);
    if (!later.length) return null;
    const first = later[0].dueAt;
    return { at: first, count: later.filter((c) => c.dueAt === first).length };
  });
  weak = computed(() => weakestOutcomes(this.stats()));

  /** Kazanım haritası: every outcome of the student's sınıf, coloured by mastery. */
  map = computed<SubjectMap[]>(() => {
    const byKey = new Map(this.stats().map((s) => [outcomeKey(s.code), s]));
    const subjects = new Map<string, SubjectMap>();
    for (const category of this.categories()) {
      if (!category.outcomes?.length) continue;
      const cells = category.outcomes.map((o) => {
        const s = byKey.get(outcomeKey(o.code));
        return {
          code: o.code,
          text: o.text,
          categoryId: category.id,
          mastery: outcomeMastery(s),
          correct: s?.correct ?? 0,
          total: s?.total ?? 0,
        };
      });
      const entry = subjects.get(category.subject) ?? { subject: category.subject, topics: [] };
      entry.topics.push({ category, cells });
      subjects.set(category.subject, entry);
    }
    return [...subjects.values()];
  });
  counts = computed(() => {
    const c: Record<OutcomeMastery, number> = { mastered: 0, learning: 0, weak: 0, none: 0 };
    for (const s of this.map()) for (const t of s.topics) for (const cell of t.cells) c[cell.mastery]++;
    return c;
  });
  totalOutcomes = computed(() => Object.values(this.counts()).reduce((a, b) => a + b, 0));
  subjectFilter = signal<string | null>(null);
  shownMap = computed(() => {
    const f = this.subjectFilter();
    return f ? this.map().filter((s) => s.subject === f) : this.map();
  });
  selected = signal<OutcomeCell | null>(null);

  // --- session ---
  mode = signal<Mode>('home');
  sessionTitle = signal('');
  questions = signal<Question[]>([]);
  index = signal(0);
  picked = signal<string | null>(null);
  correct = signal(0);
  reward = signal<GameReward | null>(null);
  error = signal<string | null>(null);
  current = computed(() => this.questions()[this.index()] ?? null);
  private log: { q: Question; correct: boolean }[] = [];
  private mistakes: GameMistake[] = [];
  private startedAt = 0;

  async startReview() {
    const ids = this.due().map((c) => c.questionId);
    await this.start('Günün Tekrarı', () => this.learning.questions(ids));
  }

  async practiceOutcome(code: string, categoryId: string) {
    await this.start(`Kazanım alıştırması · ${code}`, async () => {
      const pool = await firstValueFrom(this.firestoreSvc.questionsForCategory(categoryId, 60));
      const exact = pool.filter((q) => q.outcomeCode?.trim() === code);
      return (exact.length >= 2 ? exact : pool).slice(0, PRACTICE_SIZE);
    });
  }

  async practiceWeakest() {
    const w = this.weak()[0];
    if (w) await this.practiceOutcome(w.code, w.categoryId);
  }

  private async start(title: string, load: () => Promise<Question[]>) {
    this.mode.set('loading');
    this.error.set(null);
    this.selected.set(null);
    try {
      const qs = await load();
      if (qs.length === 0) {
        this.error.set('Bu sorular artık havuzda yok. Başka bir kazanım seç.');
        this.mode.set('home');
        return;
      }
      this.questions.set(qs.map((q) => ({ ...q, options: shuffled(Math.random, q.options) })));
      this.sessionTitle.set(title);
      this.index.set(0);
      this.picked.set(null);
      this.correct.set(0);
      this.reward.set(null);
      this.log = [];
      this.mistakes = [];
      this.startedAt = Date.now();
      this.mode.set('play');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      this.error.set('Sorular yüklenemedi. İnternet bağlantını kontrol et.');
      this.mode.set('home');
    }
  }

  choose(optionId: string) {
    const q = this.current();
    if (!q || this.picked()) return;
    this.picked.set(optionId);
    const right = optionId === q.correctOptionId;
    this.log.push({ q, correct: right });
    if (right) {
      this.correct.update((n) => n + 1);
      sfx.correct();
    } else {
      sfx.wrong();
      this.mistakes.push({
        prompt: q.prompt,
        correctAnswer: q.options.find((o) => o.id === q.correctOptionId)?.text ?? '',
        given: q.options.find((o) => o.id === optionId)?.text ?? null,
      });
    }
  }

  async next() {
    if (!this.picked()) return;
    if (this.index() < this.questions().length - 1) {
      this.index.update((i) => i + 1);
      this.picked.set(null);
      return;
    }
    this.mode.set('done');
    sfx.finish();
    const user = this.user();
    if (!user) return;
    const total = this.questions().length;
    await this.learning.record(user, this.log.map((a) => answeredPool(a.q, a.correct)));
    this.now = Date.now();
    try {
      this.reward.set(
        await this.progress.complete({
          gameType: 'quiz',
          gameKey: 'akilli-tekrar',
          title: `Akıllı Tekrar · ${this.sessionTitle()}`,
          subject: this.questions()[0]?.subject ?? '',
          grade: user.grade ?? null,
          score: this.correct() * 100,
          stars: quizStars(this.correct(), total),
          correct: this.correct(),
          total,
          durationMs: Date.now() - this.startedAt,
          mistakes: this.mistakes,
        })
      );
    } catch (err) {
      console.error('[SmartReview] saving result failed:', err);
    }
  }

  backHome() {
    this.mode.set('home');
  }

  correctText(q: Question): string {
    return q.options.find((o) => o.id === q.correctOptionId)?.text ?? '';
  }

  optionClass(id: string): string {
    const q = this.current();
    const picked = this.picked();
    if (!q || !picked) return '';
    if (id === q.correctOptionId) return 'right';
    return id === picked ? 'wrong' : 'dim';
  }

  dayLabel(at: number): string {
    const days = Math.round((at - new Date(new Date().setHours(0, 0, 0, 0)).getTime()) / 86_400_000);
    if (days <= 1) return 'yarın';
    return `${days} gün sonra`;
  }
}
