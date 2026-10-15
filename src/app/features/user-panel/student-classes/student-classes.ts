import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, map, of, switchMap } from 'rxjs';
import { AuthService } from '../../../core/services/auth';
import { ClassroomService, StudentAssignment } from '../../../core/services/classroom';
import { Classroom, KIND_LABELS } from '../../../models/classroom';
import { LeagueEntry, LiveSession } from '../../../models/live';
import { LiveService } from '../../../core/services/live';
import { toObservable } from '@angular/core/rxjs-interop';
import { DuelService } from '../../../core/services/duel';
import { NotificationService } from '../../../core/services/notifications';
import { Duel } from '../../../models/duel';
import { canPlayGames } from '../../../models/user';

const DUEL_FRESH_MS = 24 * 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Student dashboard block: join a class with a code, see classes and ödevler. */
@Component({
  selector: 'app-student-classes',
  imports: [FormsModule, RouterLink, DatePipe],
  templateUrl: './student-classes.html',
  styleUrl: './student-classes.scss',
})
export class StudentClasses {
  private auth = inject(AuthService);
  private classroom = inject(ClassroomService);
  private live = inject(LiveService);
  private duels = inject(DuelService);
  private notifications = inject(NotificationService);

  readonly kindLabels = KIND_LABELS;
  readonly now = Date.now();

  classes = toSignal(
    this.auth.appUser$.pipe(switchMap((u) => (u ? this.classroom.studentClasses(u) : of([])))),
    { initialValue: [] }
  );
  assignments = toSignal(
    this.auth.appUser$.pipe(switchMap((u) => (u ? this.classroom.studentAssignments(u) : of([])))),
    { initialValue: [] as StudentAssignment[] }
  );

  /** Live competitions running right now in my classes. */
  liveNow = toSignal(
    toObservable(this.classes).pipe(
      switchMap((classes: Classroom[]) =>
        classes.length === 0
          ? of([] as { classroom: Classroom; session: LiveSession }[])
          : combineLatest(
              classes.map((c) =>
                this.live.activeSessions(c.id).pipe(map((list) => list.map((session) => ({ classroom: c, session }))))
              )
            ).pipe(map((groups) => groups.flat()))
      )
    ),
    { initialValue: [] }
  );

  /** Düellolar I was invited to or opened, still waiting or running. */
  openDuels = toSignal(
    combineLatest([toObservable(this.classes), this.auth.appUser$]).pipe(
      switchMap(([classes, user]) =>
        !user || classes.length === 0
          ? of([] as { classroom: Classroom; duel: Duel; invited: boolean }[])
          : combineLatest(
              classes.flatMap((c) => [
                this.duels.openFor(c.id, user.uid).pipe(map((list) => list.map((duel) => ({ classroom: c, duel, invited: true })))),
                this.duels.mine(c.id, user.uid).pipe(
                  map((list) =>
                    list
                      .filter((d) => d.status !== 'finished' && Date.now() - d.createdAt < DUEL_FRESH_MS)
                      .map((duel) => ({ classroom: c, duel, invited: false }))
                  )
                ),
              ])
            ).pipe(
              map((groups) => {
                const byId = new Map<string, { classroom: Classroom; duel: Duel; invited: boolean }>();
                for (const g of groups.flat()) if (!byId.has(g.duel.id)) byId.set(g.duel.id, g);
                return [...byId.values()].sort((a, b) => b.duel.createdAt - a.duel.createdAt);
              })
            )
      )
    ),
    { initialValue: [] }
  );

  /** Latest notes from my teachers. */
  messages = computed(() => this.notifications.messages().slice(0, 3));
  classNames = computed(() => new Map(this.classes().map((c) => [c.id, c.name])));

  /** This week's league for each class. */
  leagues = toSignal(
    toObservable(this.classes).pipe(
      switchMap((classes: Classroom[]) =>
        classes.length === 0
          ? of([] as { classroom: Classroom; entries: LeagueEntry[] }[])
          : combineLatest(
              classes.map((c) => this.classroom.league(c.id).pipe(map((entries) => ({ classroom: c, entries }))))
            )
      )
    ),
    { initialValue: [] }
  );
  canDuel = toSignal(this.auth.appUser$.pipe(map((u) => canPlayGames(u))), { initialValue: false });
  myUid = toSignal(this.auth.appUser$.pipe(map((u) => u?.uid ?? null)), { initialValue: null });

  /** Top 5, plus me below them when I'm not in the top 5. */
  leagueRows(entries: LeagueEntry[]): { rank: number; entry: LeagueEntry }[] {
    const rows = entries.map((entry, i) => ({ rank: i + 1, entry }));
    const top = rows.slice(0, 5);
    const mine = rows.find((r) => r.entry.uid === this.myUid());
    return mine && mine.rank > 5 ? [...top, mine] : top;
  }

  pending = computed(() => this.assignments().filter((a) => !a.submission));
  done = computed(() => this.assignments().filter((a) => a.submission).slice(0, 6));

  code = '';
  joining = signal(false);
  message = signal<{ type: 'success' | 'danger'; text: string } | null>(null);
  showJoin = signal(false);

  async join() {
    if (!this.code.trim() || this.joining()) return;
    this.joining.set(true);
    this.message.set(null);
    try {
      const name = await this.classroom.joinWithCode(this.code);
      this.message.set({ type: 'success', text: `🎉 "${name}" sınıfına katıldın!` });
      this.code = '';
      this.showJoin.set(false);
    } catch (err: any) {
      const text =
        err?.code === 'permission-denied'
          ? 'Bu sınıfa katılamadın. Kodun doğru olduğundan emin ol.'
          : (err?.message ?? 'Sınıfa katılırken bir sorun oluştu.');
      this.message.set({ type: 'danger', text });
    } finally {
      this.joining.set(false);
    }
  }

  dueLabel(dueAt: number | null): { text: string; tone: string } | null {
    if (!dueAt) return null;
    const left = dueAt - this.now;
    if (left < 0) return { text: 'Süresi geçti', tone: 'red' };
    if (left < DAY_MS) return { text: 'Bugün son gün', tone: 'amber' };
    const days = Math.ceil(left / DAY_MS);
    return { text: `${days} gün kaldı`, tone: days <= 2 ? 'amber' : 'indigo' };
  }

  stars(n: number): string {
    return '★'.repeat(n) + '☆'.repeat(3 - n);
  }
}
