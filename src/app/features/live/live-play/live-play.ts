import { Component, DestroyRef, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom, filter, of, switchMap, take } from 'rxjs';
import { AuthService } from '../../../core/services/auth';
import { LiveService } from '../../../core/services/live';
import { GameProgressService } from '../../../core/services/game-progress';
import { GameMistake, GameReward } from '../../../games/game-models';
import { quizStars } from '../../../games/scoring';
import { sfx } from '../../../games/sound';
import { LIVE_SHAPES } from '../live-host/live-host';

/** /canli/:classId/:sessionId — a student's phone or tablet during a live competition. */
@Component({
  selector: 'app-live-play',
  imports: [RouterLink],
  templateUrl: './live-play.html',
  styleUrl: './live-play.scss',
})
export class LivePlay implements OnInit {
  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);
  private live = inject(LiveService);
  private progress = inject(GameProgressService);
  private destroyRef = inject(DestroyRef);

  readonly classId = this.route.snapshot.paramMap.get('classId') ?? '';
  readonly sessionId = this.route.snapshot.paramMap.get('sessionId') ?? '';
  readonly shapes = LIVE_SHAPES;

  session = toSignal(this.live.session(this.classId, this.sessionId));
  me = toSignal(
    this.auth.appUser$.pipe(switchMap((u) => (u ? this.live.me(this.classId, this.sessionId, u.uid) : of(null)))),
    { initialValue: null }
  );

  joinError = signal<string | null>(null);
  answerError = signal<string | null>(null);
  /** My choice per question index. */
  choices = signal<Record<number, number>>({});
  sending = signal(false);
  now = signal(Date.now());
  reward = signal<GameReward | null>(null);
  private shownAt = new Map<number, number>();
  private mistakes = new Map<number, GameMistake>();
  private saved = false;
  private lastSoundFor = -1;

  myChoice = computed(() => {
    const s = this.session();
    return s ? (this.choices()[s.questionIndex] ?? null) : null;
  });
  remaining = computed(() => {
    const s = this.session();
    if (!s || s.status !== 'question') return 0;
    const shown = this.shownAt.get(s.questionIndex) ?? this.now();
    return Math.max(0, Math.ceil((shown + s.durationSec * 1000 - this.now()) / 1000));
  });
  timerPct = computed(() => {
    const s = this.session();
    return s ? Math.round((this.remaining() / s.durationSec) * 100) : 0;
  });

  constructor() {
    // Remember when each question appeared here, for the on-screen countdown.
    effect(() => {
      const s = this.session();
      if (s?.status === 'question' && !this.shownAt.has(s.questionIndex)) {
        this.shownAt.set(s.questionIndex, Date.now());
      }
    });
    // Reveal: play a sound once and keep my mistake for the result.
    effect(() => {
      const s = this.session();
      const me = this.me();
      if (s?.status !== 'reveal' || !s.reveal || !me || this.lastSoundFor === s.questionIndex) return;
      untracked(() => {
        this.lastSoundFor = s.questionIndex;
        const choice = this.choices()[s.questionIndex];
        const right = choice === s.reveal!.correctIndex;
        if (choice !== undefined) (right ? sfx.correct : sfx.wrong)();
        if (!right && s.question) {
          this.mistakes.set(s.questionIndex, {
            prompt: s.question.prompt,
            correctAnswer: s.question.options[s.reveal!.correctIndex] ?? '',
            given: choice !== undefined ? (s.question.options[choice] ?? null) : null,
          });
        }
      });
    });
    // Finished: save XP, streak, league and tracking once.
    effect(() => {
      const s = this.session();
      const me = this.me();
      if (s?.status === 'finished' && me && !this.saved) {
        this.saved = true;
        untracked(() => void this.save());
      }
    });
  }

  async ngOnInit() {
    const timer = setInterval(() => this.now.set(Date.now()), 250);
    this.destroyRef.onDestroy(() => clearInterval(timer));
    const user = await firstValueFrom(this.auth.appUser$.pipe(filter((u) => u !== undefined), take(1)));
    if (!user) return;
    try {
      await this.live.join(this.classId, this.sessionId, user);
    } catch (err: any) {
      this.joinError.set(
        err?.code === 'permission-denied'
          ? 'Bu yarışmaya katılamadın. Sınıfta olduğundan ve yarışmanın bitmediğinden emin ol.'
          : 'Yarışmaya bağlanırken bir sorun oldu.'
      );
    }
  }

  async choose(index: number) {
    const s = this.session();
    const me = this.me();
    if (!s || !me || s.status !== 'question' || this.myChoice() !== null || this.sending()) return;
    this.sending.set(true);
    this.answerError.set(null);
    this.choices.update((c) => ({ ...c, [s.questionIndex]: index }));
    try {
      await this.live.answer(this.classId, this.sessionId, s.questionIndex, index, me.uid);
    } catch {
      this.answerError.set('Cevabın yetişmedi, süre dolmuş olabilir.');
      this.choices.update((c) => {
        const next = { ...c };
        delete next[s.questionIndex];
        return next;
      });
    } finally {
      this.sending.set(false);
    }
  }

  private async save() {
    const s = this.session();
    const me = this.me();
    if (!s || !me) return;
    sfx.finish();
    const total = s.questionCount;
    try {
      const reward = await this.progress.complete({
        gameType: 'quiz',
        gameKey: `canli-${this.sessionId}`,
        title: `Canlı Yarışma · ${s.title}`,
        subject: s.subject,
        grade: null,
        categoryId: s.categoryId ?? undefined,
        score: me.score,
        stars: quizStars(me.correct, total),
        correct: me.correct,
        total,
        durationMs: 0,
        mistakes: [...this.mistakes.values()],
      });
      this.reward.set(reward);
    } catch (err) {
      console.error('[LivePlay] saving result failed:', err);
    }
  }
}
