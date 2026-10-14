import { Component, HostListener, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom, take } from 'rxjs';
import { GameResult } from '../game-result/game-result';
import { FirestoreService } from '../../../core/services/firestore';
import { GameProgressService } from '../../../core/services/game-progress';
import { Question } from '../../../models/question';
import { TestCategory } from '../../../models/test-category';
import { GameMistake, GameOutcome, GameReward } from '../../../games/game-models';
import { shuffled } from '../../../games/math-generator';
import { quizStars } from '../../../games/scoring';
import { setSoundEnabled, sfx, soundEnabled, speak, speechSupported } from '../../../games/sound';

const QUESTION_COUNT = 10;
const MIN_QUESTIONS = 3;
const QUESTION_MS = 25_000;

type Phase = 'loading' | 'empty' | 'intro' | 'playing' | 'reveal' | 'done';

/**
 * Bilgi Yarışması: the approved question pool as a game — per-question timer,
 * speed bonus, streak bonus, one 50:50 joker, explanation after each answer.
 */
@Component({
  selector: 'app-quiz',
  imports: [RouterLink, GameResult],
  templateUrl: './quiz.html',
  styleUrl: './quiz.scss',
})
export class Quiz implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private firestoreSvc = inject(FirestoreService);
  private progress = inject(GameProgressService);

  readonly categoryId = this.route.snapshot.paramMap.get('categoryId') ?? '';
  readonly canSpeak = speechSupported();
  readonly letters = ['A', 'B', 'C', 'D', 'E'];

  phase = signal<Phase>('loading');
  category = signal<TestCategory | null>(null);
  questions = signal<Question[]>([]);
  index = signal(0);
  picked = signal<string | null>(null);
  hidden = signal<Set<string>>(new Set());
  jokerUsed = signal(false);
  remainingMs = signal(QUESTION_MS);
  score = signal(0);
  correct = signal(0);
  streak = signal(0);
  lastPoints = signal(0);
  sound = signal(soundEnabled());

  outcome = signal<GameOutcome | null>(null);
  reward = signal<GameReward | null>(null);

  current = computed(() => this.questions()[this.index()] ?? null);
  isLast = computed(() => this.index() >= this.questions().length - 1);
  timePercent = computed(() => (this.remainingMs() / QUESTION_MS) * 100);
  secondsLeft = computed(() => Math.ceil(this.remainingMs() / 1000));
  wasCorrect = computed(() => {
    const q = this.current();
    return !!q && this.picked() === q.correctOptionId;
  });
  correctText = computed(() => {
    const q = this.current();
    return q?.options.find((o) => o.id === q.correctOptionId)?.text ?? '';
  });

  private mistakes: GameMistake[] = [];
  private maxCombo = 0;
  private startedAt = 0;
  private questionStartedAt = 0;
  private tick: ReturnType<typeof setInterval> | null = null;

  async ngOnInit() {
    const [category, questions] = await Promise.all([
      firstValueFrom(this.firestoreSvc.categoryById(this.categoryId).pipe(take(1))),
      firstValueFrom(this.firestoreSvc.questionsForCategory(this.categoryId, QUESTION_COUNT)),
    ]);
    this.category.set(category ?? null);
    this.questions.set(questions.map((q) => ({ ...q, options: shuffled(Math.random, q.options) })));
    this.phase.set(questions.length >= MIN_QUESTIONS ? 'intro' : 'empty');
  }

  start() {
    this.index.set(0);
    this.score.set(0);
    this.correct.set(0);
    this.streak.set(0);
    this.jokerUsed.set(false);
    this.mistakes = [];
    this.maxCombo = 0;
    this.outcome.set(null);
    this.reward.set(null);
    this.startedAt = Date.now();
    // Fresh option order on replay.
    this.questions.update((qs) => shuffled(Math.random, qs).map((q) => ({ ...q, options: shuffled(Math.random, q.options) })));
    this.showQuestion();
  }

  choose(optionId: string) {
    const q = this.current();
    if (!q || this.phase() !== 'playing') return;
    this.stopTick();
    this.picked.set(optionId);

    if (optionId === q.correctOptionId) {
      const elapsed = Date.now() - this.questionStartedAt;
      const speedBonus = Math.round(50 * Math.max(0, 1 - elapsed / QUESTION_MS));
      const streakBonus = Math.min(50, 10 * this.streak());
      const points = 100 + speedBonus + streakBonus;
      this.lastPoints.set(points);
      this.score.update((s) => s + points);
      this.correct.update((n) => n + 1);
      this.streak.update((n) => n + 1);
      this.maxCombo = Math.max(this.maxCombo, this.streak());
      sfx.correct();
    } else {
      this.recordMistake(q, optionId);
      sfx.wrong();
    }
    this.phase.set('reveal');
  }

  useJoker() {
    const q = this.current();
    if (!q || this.jokerUsed() || this.phase() !== 'playing') return;
    const wrong = shuffled(
      Math.random,
      q.options.filter((o) => o.id !== q.correctOptionId).map((o) => o.id)
    );
    this.hidden.set(new Set(wrong.slice(0, Math.max(0, q.options.length - 2))));
    this.jokerUsed.set(true);
  }

  next() {
    if (this.phase() !== 'reveal') return;
    if (this.isLast()) {
      this.finish();
      return;
    }
    this.index.update((i) => i + 1);
    this.showQuestion();
  }

  readAloud() {
    const q = this.current();
    if (!q) return;
    speak([q.prompt, ...q.options.map((o, i) => `${this.letters[i]}: ${o.text}`)].join('. '));
  }

  toggleSound() {
    const on = !this.sound();
    this.sound.set(on);
    setSoundEnabled(on);
  }

  @HostListener('window:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    const q = this.current();
    if (this.phase() === 'playing' && q) {
      const idx = Number(e.key) - 1;
      const opt = q.options[idx];
      if (opt && !this.hidden().has(opt.id)) this.choose(opt.id);
    } else if (this.phase() === 'reveal' && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      this.next();
    }
  }

  ngOnDestroy() {
    this.stopTick();
  }

  private showQuestion() {
    this.picked.set(null);
    this.hidden.set(new Set());
    this.lastPoints.set(0);
    this.remainingMs.set(QUESTION_MS);
    this.questionStartedAt = Date.now();
    this.phase.set('playing');
    this.stopTick();
    this.tick = setInterval(() => {
      const left = QUESTION_MS - (Date.now() - this.questionStartedAt);
      this.remainingMs.set(Math.max(0, left));
      if (left <= 0) this.timeUp();
    }, 100);
  }

  private timeUp() {
    const q = this.current();
    this.stopTick();
    if (!q || this.phase() !== 'playing') return;
    this.recordMistake(q, null);
    sfx.wrong();
    this.phase.set('reveal');
  }

  private recordMistake(q: Question, optionId: string | null) {
    this.streak.set(0);
    this.lastPoints.set(0);
    this.mistakes.push({
      prompt: q.prompt,
      correctAnswer: q.options.find((o) => o.id === q.correctOptionId)?.text ?? '',
      given: optionId === null ? null : (q.options.find((o) => o.id === optionId)?.text ?? optionId),
    });
  }

  private stopTick() {
    if (this.tick) clearInterval(this.tick);
    this.tick = null;
  }

  private async finish() {
    this.phase.set('done');
    sfx.finish();
    const cat = this.category();
    const total = this.questions().length;
    const outcome: GameOutcome = {
      gameType: 'quiz',
      gameKey: this.categoryId,
      title: `Bilgi Yarışması · ${cat ? `${cat.subject} – ${cat.topic}` : 'Karışık'}`,
      subject: cat?.subject ?? '',
      grade: cat?.grades?.length === 1 ? cat.grades[0] : null,
      categoryId: this.categoryId,
      score: this.score(),
      stars: quizStars(this.correct(), total),
      correct: this.correct(),
      total,
      durationMs: Date.now() - this.startedAt,
      mistakes: this.mistakes,
      meta: { maxCombo: this.maxCombo },
    };
    this.outcome.set(outcome);
    this.reward.set(await this.progress.complete(outcome));
  }
}
