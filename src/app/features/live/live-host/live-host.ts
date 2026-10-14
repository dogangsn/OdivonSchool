import { Component, DestroyRef, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { of, switchMap } from 'rxjs';
import { LiveService } from '../../../core/services/live';
import { LIVE_GRACE_SEC, rankPlayers, scoreQuestion, toMillis } from '../../../core/live-scoring';
import { LivePlayer, LiveQuestion } from '../../../models/live';
import { sfx } from '../../../games/sound';

export const LIVE_SHAPES = ['▲', '◆', '●', '■', '★'];

/**
 * /ogretmen/canli/:classId/:sessionId — the projector screen. This page runs
 * the game: it opens questions, closes them when time is up (or everyone has
 * answered), scores the answers and moves on.
 */
@Component({
  selector: 'app-live-host',
  imports: [RouterLink],
  templateUrl: './live-host.html',
  styleUrl: './live-host.scss',
})
export class LiveHost implements OnInit {
  private route = inject(ActivatedRoute);
  private live = inject(LiveService);
  private destroyRef = inject(DestroyRef);

  readonly classId = this.route.snapshot.paramMap.get('classId') ?? '';
  readonly sessionId = this.route.snapshot.paramMap.get('sessionId') ?? '';
  readonly shapes = LIVE_SHAPES;

  session = toSignal(this.live.session(this.classId, this.sessionId));
  players = toSignal(this.live.players(this.classId, this.sessionId), { initialValue: [] as LivePlayer[] });
  answered = toSignal(
    toObservable(computed(() => (this.session()?.status === 'question' ? this.session()!.questionIndex : -1))).pipe(
      switchMap((q) => (q >= 0 ? this.live.answerCount(this.classId, this.sessionId, q) : of(0)))
    ),
    { initialValue: 0 }
  );

  questions = signal<LiveQuestion[]>([]);
  busy = signal(false);
  error = signal<string | null>(null);
  now = signal(Date.now());
  /** Local time the open question ends, for the countdown. */
  private deadline = signal<number | null>(null);
  private revealing = false;
  /** Question whose automatic close failed; the teacher retries by hand. */
  private autoRevealFailed = -1;

  current = computed(() => {
    const s = this.session();
    return s && s.questionIndex >= 0 ? (this.questions()[s.questionIndex] ?? null) : null;
  });
  remaining = computed(() => {
    const d = this.deadline();
    return d === null ? 0 : Math.max(0, Math.ceil((d - this.now()) / 1000));
  });
  timerPct = computed(() => {
    const s = this.session();
    return s ? Math.round((this.remaining() / s.durationSec) * 100) : 0;
  });
  isLast = computed(() => {
    const s = this.session();
    return !!s && s.questionIndex + 1 >= s.questionCount;
  });
  ranked = computed(() => rankPlayers(Object.fromEntries(this.players().map((p) => [p.uid, { ...p }]))));
  podium = computed(() => this.ranked().slice(0, 3));
  sortedPlayers = computed(() =>
    [...this.players()].sort((a, b) => a.joinedAt - b.joinedAt)
  );

  constructor() {
    // Close the question when the timer (plus grace) runs out or everyone answered.
    effect(() => {
      const s = this.session();
      const deadline = this.deadline();
      const now = this.now();
      const answered = this.answered();
      const players = this.players().length;
      if (!s || s.status !== 'question' || deadline === null || s.questionIndex === this.autoRevealFailed) return;
      const allIn = players > 0 && answered >= players;
      if (allIn || now >= deadline + LIVE_GRACE_SEC * 1000) {
        untracked(() => void this.reveal());
      }
    });
    // Restore the countdown after a page reload during a question.
    effect(() => {
      const s = this.session();
      if (s?.status === 'question' && this.deadline() === null) {
        const started = toMillis(s.question?.startedAt);
        if (started) untracked(() => this.deadline.set(started + s.durationSec * 1000));
      }
      if (s && s.status !== 'question') untracked(() => this.deadline.set(null));
    });
  }

  async ngOnInit() {
    const timer = setInterval(() => this.now.set(Date.now()), 250);
    this.destroyRef.onDestroy(() => clearInterval(timer));
    try {
      this.questions.set(await this.live.questions(this.classId, this.sessionId));
    } catch (err: any) {
      this.error.set(`Sorular yüklenemedi: ${err?.message ?? err}`);
    }
  }

  async start() {
    await this.open(0);
  }

  async next() {
    const s = this.session();
    if (!s) return;
    if (this.isLast()) {
      await this.finish();
    } else {
      await this.open(s.questionIndex + 1);
    }
  }

  async finish() {
    const s = this.session();
    if (!s || this.busy()) return;
    if (s.status === 'question' && !confirm('Yarışma şimdi bitirilsin mi?')) return;
    this.busy.set(true);
    try {
      const top = this.ranked()
        .slice(0, 10)
        .map((p) => ({ uid: p.uid, name: p.displayName, score: p.score, correct: p.correct, gained: p.lastGained }));
      await this.live.finish(this.classId, this.sessionId, top);
      sfx.finish();
    } catch (err: any) {
      this.error.set(`Yarışma bitirilemedi: ${err?.message ?? err}`);
    } finally {
      this.busy.set(false);
    }
  }

  private async open(index: number) {
    const s = this.session();
    const q = this.questions()[index];
    if (!s || !q || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.live.openQuestion(this.classId, this.sessionId, index, q, s.durationSec, this.players().length);
      this.deadline.set(Date.now() + s.durationSec * 1000);
    } catch (err: any) {
      this.error.set(`Soru açılamadı: ${err?.message ?? err}`);
    } finally {
      this.busy.set(false);
    }
  }

  private async reveal() {
    const s = this.session();
    const q = this.current();
    if (!s || !q || this.revealing) return;
    this.revealing = true;
    try {
      const startedAt =
        toMillis(s.question?.startedAt) ?? (await this.live.questionStartedAt(this.classId, this.sessionId));
      const answers = await this.live.answers(this.classId, this.sessionId, s.questionIndex);
      const players = Object.fromEntries(this.players().map((p) => [p.uid, p]));
      const result = scoreQuestion(players, answers, q, startedAt ?? 0, s.durationSec);
      const ranked = rankPlayers(result.players);
      await this.live.reveal(
        this.classId,
        this.sessionId,
        { correctIndex: q.correctIndex, counts: result.counts, explanation: q.explanation },
        result.leaderboard,
        ranked
      );
      this.deadline.set(null);
      sfx.correct();
    } catch (err: any) {
      this.autoRevealFailed = s.questionIndex;
      this.error.set(`Cevaplar puanlanamadı: ${err?.message ?? err}. Tekrar denemek için "Cevabı göster"e basın.`);
    } finally {
      this.revealing = false;
    }
  }

  /** Manual close, e.g. when one student never answers. */
  async revealNow() {
    this.autoRevealFailed = -1;
    this.deadline.set(Date.now() - LIVE_GRACE_SEC * 1000);
    await this.reveal();
  }

  countFor(i: number): number {
    return this.session()?.reveal?.counts[i] ?? 0;
  }

  maxCount(): number {
    return Math.max(1, ...(this.session()?.reveal?.counts ?? [0]));
  }
}
