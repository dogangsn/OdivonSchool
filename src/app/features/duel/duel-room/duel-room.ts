import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { AuthService } from '../../../core/services/auth';
import { DuelService } from '../../../core/services/duel';
import { GameProgressService } from '../../../core/services/game-progress';
import { Duel, DuelPlayer } from '../../../models/duel';
import { GameMistake, GameReward } from '../../../games/game-models';
import { quizStars } from '../../../games/scoring';
import { sfx } from '../../../games/sound';
import { toMillis } from '../../../core/live-scoring';
import { duelPath, duelPoints, everyoneDone, rankDuelPlayers, whatsappShareUrl } from '../../../core/duel';
import { LIVE_SHAPES } from '../../live/live-host/live-host';

type Feedback = { right: boolean; correctIndex: number; chosen: number } | null;

/**
 * /duello/:classId/:duelId — one page for the whole düello: the lobby with the
 * link to share, the race itself and the results. The host (the student who
 * opened it, or the teacher) presses Başlat; every player answers the same
 * questions on their own device and writes only their own progress.
 */
@Component({
  selector: 'app-duel-room',
  imports: [RouterLink, NgTemplateOutlet],
  templateUrl: './duel-room.html',
  styleUrl: './duel-room.scss',
})
export class DuelRoom {
  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);
  private duels = inject(DuelService);
  private progress = inject(GameProgressService);
  private destroyRef = inject(DestroyRef);

  readonly classId = this.route.snapshot.paramMap.get('classId') ?? '';
  readonly duelId = this.route.snapshot.paramMap.get('duelId') ?? '';
  readonly shapes = LIVE_SHAPES;
  readonly shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}${duelPath(this.classId, this.duelId)}`;

  /** 'loading' until the first snapshot; null = not allowed, undefined = gone. */
  private duelState = toSignal<{ d: Duel | null | undefined | 'loading' }, { d: 'loading' }>(
    this.duels.duel(this.classId, this.duelId).pipe(map((d) => ({ d }))),
    { initialValue: { d: 'loading' } }
  );
  loading = computed(() => this.duelState().d === 'loading');
  duel = computed<Duel | null>(() => {
    const d = this.duelState().d;
    return d && d !== 'loading' ? d : null;
  });
  denied = computed(() => this.duelState().d === null);

  players = toSignal(this.duels.players(this.classId, this.duelId), { initialValue: [] as DuelPlayer[] });
  user = toSignal(this.auth.appUser$, { initialValue: null });

  now = signal(Date.now());
  copied = signal(false);
  busy = signal(false);
  error = signal<string | null>(null);

  // --- my game ---
  index = signal(0);
  correct = signal(0);
  score = signal(0);
  feedback = signal<Feedback>(null);
  finishedLocally = signal(false);
  reward = signal<GameReward | null>(null);
  private startLocal: number | null = null;
  private shownAt = Date.now();
  private mistakes: GameMistake[] = [];
  private writes: Promise<unknown> = Promise.resolve();
  private restored = false;
  private hostFinishing = false;
  private expiryTried = false;

  /** The teacher goes back to the class page, students to their panel. */
  backLink = computed(() => (this.duel()?.byTeacher && this.isHost() ? ['/ogretmen/sinif', this.classId] : ['/panel']));
  backLabel = computed(() => (this.duel()?.byTeacher && this.isHost() ? 'Sınıf' : 'Panel'));
  uid = computed(() => this.user()?.uid ?? null);
  isHost = computed(() => !!this.duel() && this.duel()!.createdBy === this.uid());
  amPlayer = computed(() => !!this.uid() && !!this.duel()?.joined.includes(this.uid()!));
  me = computed(() => this.players().find((p) => p.uid === this.uid()) ?? null);
  ranked = computed(() => rankDuelPlayers(this.players()));
  question = computed(() => this.duel()?.questions[this.index()] ?? null);
  total = computed(() => this.duel()?.questions.length ?? 0);

  invitedLeft = computed(() => {
    const d = this.duel();
    if (!d) return 0;
    return Math.max(0, d.maxPlayers - d.joined.length);
  });
  emptySlots = computed(() => Array.from({ length: Math.min(this.invitedLeft(), 40) }, (_, i) => i));
  canJoin = computed(() => {
    const d = this.duel();
    const uid = this.uid();
    if (!d || !uid || d.status !== 'waiting' || this.amPlayer()) return false;
    if (d.byTeacher && d.createdBy === uid) return false;
    if (d.joined.length >= d.maxPlayers) return false;
    return d.invited.length === 0 || d.invited.includes(uid);
  });
  notInvited = computed(() => {
    const d = this.duel();
    const uid = this.uid();
    return !!d && !!uid && d.invited.length > 0 && !d.invited.includes(uid) && d.createdBy !== uid;
  });
  canStart = computed(() => {
    const d = this.duel();
    return !!d && this.isHost() && d.status === 'waiting' && d.joined.length >= (d.byTeacher ? 1 : 2);
  });

  /** I'm a player and still answering. */
  playing = computed(() => {
    const d = this.duel();
    return !!d && d.status === 'running' && this.amPlayer() && !this.finishedLocally() && !this.me()?.done;
  });
  timeLeft = computed(() => {
    const d = this.duel();
    if (!d || this.startLocal === null) return d?.timeLimitSec ?? 0;
    return Math.max(0, Math.ceil((this.startLocal + d.timeLimitSec * 1000 - this.now()) / 1000));
  });
  timerPct = computed(() => {
    const d = this.duel();
    return d ? Math.round((this.timeLeft() / d.timeLimitSec) * 100) : 0;
  });
  /** Server-side clock for spectators (teacher, finished players). */
  serverLeft = computed(() => {
    const d = this.duel();
    const started = toMillis(d?.startedAt);
    if (!d || started === null) return null;
    return Math.max(0, Math.ceil((started + d.timeLimitSec * 1000 - this.now()) / 1000));
  });
  allDone = computed(() => everyoneDone(this.duel()?.joined ?? [], this.players()));
  showResults = computed(() => {
    const d = this.duel();
    return !!d && (d.status === 'finished' || (this.amPlayer() && (this.finishedLocally() || !!this.me()?.done)));
  });
  whatsapp = computed(() => {
    const d = this.duel();
    const who = d?.byTeacher ? 'Öğretmenin bir karşılaşma kurdu' : `${d?.creatorName ?? 'Arkadaşın'} seni düelloya çağırıyor`;
    return whatsappShareUrl(`⚔️ ${who}: "${d?.title ?? ''}". Katılmak için: ${this.shareUrl}`);
  });

  constructor() {
    const timer = setInterval(() => this.now.set(Date.now()), 250);
    this.destroyRef.onDestroy(() => clearInterval(timer));

    // Start (or resume after a reload) my clock once the duel is running.
    effect(() => {
      const d = this.duel();
      const me = this.me();
      if (!d || d.status !== 'running' || !this.amPlayer() || this.restored || !me) return;
      untracked(() => {
        this.restored = true;
        if (me.done) {
          this.finishedLocally.set(true);
          return;
        }
        this.index.set(me.answered);
        this.correct.set(me.correct);
        this.score.set(me.score);
        this.startLocal = Date.now() - me.durationMs;
        this.shownAt = Date.now();
      });
    });

    // My time ran out.
    effect(() => {
      if (this.playing() && this.startLocal !== null && this.timeLeft() === 0) {
        untracked(() => this.finishMine());
      }
    });

    // Host: close the duel when every player has finished.
    effect(() => {
      const d = this.duel();
      if (d?.status === 'running' && this.isHost() && this.allDone() && !this.hostFinishing) {
        this.hostFinishing = true;
        untracked(() => this.duels.finish(this.classId, this.duelId).catch(() => (this.hostFinishing = false)));
      }
    });

    // Anyone in it: close a duel whose time is long over (host may have left).
    effect(() => {
      const left = this.serverLeft();
      const d = this.duel();
      if (d?.status === 'running' && left === 0 && this.amPlayer() && !this.expiryTried) {
        const started = toMillis(d.startedAt)!;
        if (this.now() > started + (d.timeLimitSec + 8) * 1000) {
          this.expiryTried = true;
          untracked(() => this.duels.finish(this.classId, this.duelId).catch(() => undefined));
        }
      }
    });
  }

  async join() {
    const user = this.user();
    if (!user || !this.canJoin() || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.duels.join(this.classId, this.duelId, user);
    } catch (err: any) {
      this.error.set(
        err?.code === 'permission-denied'
          ? 'Katılamadın: düello dolmuş ya da başlamış olabilir.'
          : 'Düelloya bağlanırken bir sorun oldu.'
      );
    } finally {
      this.busy.set(false);
    }
  }

  async start() {
    if (!this.canStart() || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.duels.start(this.classId, this.duelId);
    } catch {
      this.error.set('Başlatılamadı. Sayfayı yenileyip tekrar deneyin.');
    } finally {
      this.busy.set(false);
    }
  }

  async end() {
    if (!this.isHost() || this.busy()) return;
    this.busy.set(true);
    try {
      await this.duels.finish(this.classId, this.duelId);
    } finally {
      this.busy.set(false);
    }
  }

  async cancel() {
    if (!this.isHost() || this.busy()) return;
    if (!confirm('Bu düello silinsin mi?')) return;
    await this.duels.remove(this.classId, this.duelId);
  }

  async copyLink() {
    try {
      await navigator.clipboard.writeText(this.shareUrl);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      prompt('Linki kopyalayın:', this.shareUrl);
    }
  }

  choose(choice: number) {
    const q = this.question();
    const uid = this.uid();
    if (!q || !uid || !this.playing() || this.feedback()) return;
    const right = choice === q.correctIndex;
    const gained = duelPoints(right, Date.now() - this.shownAt);
    (right ? sfx.correct : sfx.wrong)();
    if (!right) {
      this.mistakes.push({ prompt: q.prompt, correctAnswer: q.options[q.correctIndex] ?? '', given: q.options[choice] ?? null });
    }
    this.correct.update((c) => c + (right ? 1 : 0));
    this.score.update((s) => s + gained);
    this.feedback.set({ right, correctIndex: q.correctIndex, chosen: choice });
    const answered = this.index() + 1;
    const last = answered >= this.total();
    this.push({ answered, done: last });

    setTimeout(() => {
      this.feedback.set(null);
      if (last) {
        this.finishedLocally.set(true);
        void this.saveXp();
      } else {
        this.index.set(answered);
        this.shownAt = Date.now();
      }
    }, right ? 600 : 1200);
  }

  private finishMine() {
    if (this.finishedLocally()) return;
    this.finishedLocally.set(true);
    this.push({ answered: this.index(), done: true });
    void this.saveXp();
  }

  /** Writes my progress in order, never two at once. */
  private push(p: { answered: number; done: boolean }) {
    const uid = this.uid();
    if (!uid) return;
    const data = {
      answered: p.answered,
      correct: this.correct(),
      score: this.score(),
      durationMs: Math.max(0, Math.round(Date.now() - (this.startLocal ?? Date.now()))),
      done: p.done,
    };
    this.writes = this.writes
      .then(() => this.duels.saveProgress(this.classId, this.duelId, uid, data))
      .catch((err) => console.warn('[DuelRoom] progress not saved:', err));
  }

  private async saveXp() {
    const d = this.duel();
    if (!d) return;
    sfx.finish();
    await this.writes;
    try {
      const reward = await this.progress.complete({
        gameType: 'quiz',
        gameKey: `duello-${this.duelId}`,
        title: `${d.byTeacher ? 'Karşılaşma' : 'Düello'} · ${d.title}`,
        subject: d.subject,
        grade: null,
        score: this.score(),
        stars: quizStars(this.correct(), this.total()),
        correct: this.correct(),
        total: this.total(),
        durationMs: Math.round(Date.now() - (this.startLocal ?? Date.now())),
        mistakes: this.mistakes,
      });
      this.reward.set(reward);
    } catch (err) {
      console.error('[DuelRoom] saving result failed:', err);
    }
  }

  barPct(p: DuelPlayer): number {
    return this.total() ? Math.round((p.answered / this.total()) * 100) : 0;
  }

  medal(i: number): string {
    return ['🥇', '🥈', '🥉'][i] ?? `${i + 1}.`;
  }
}
