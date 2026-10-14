import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap } from 'rxjs';
import { AuthService } from '../../../../core/services/auth';
import { ClassroomService } from '../../../../core/services/classroom';
import { buildTracking, masteryLevel } from '../../../../core/tracking';
import { Assignment, ClassMember, ClassProgress, Submission } from '../../../../models/classroom';

interface TopicLine {
  key: string;
  label: string;
  subject: string;
  pct: number;
  total: number;
}

/**
 * /ogretmen/sinif/:classId/rapor[?ogrenci=uid] — one printable A4 report per
 * student for parents: activity, success by topic, assignments and a note.
 */
@Component({
  selector: 'app-parent-report',
  imports: [RouterLink, DatePipe],
  templateUrl: './parent-report.html',
  styleUrl: './parent-report.scss',
})
export class ParentReport {
  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);
  private classroomSvc = inject(ClassroomService);

  readonly classId = this.route.snapshot.paramMap.get('classId') ?? '';
  readonly only = this.route.snapshot.queryParamMap.get('ogrenci');
  readonly today = Date.now();
  readonly level = masteryLevel;

  teacher = toSignal(this.auth.appUser$, { initialValue: null });
  classroom = toSignal(this.classroomSvc.classById(this.classId).pipe(catchError(() => of(undefined))));
  members = toSignal(this.classroomSvc.members(this.classId).pipe(catchError(() => of([]))), {
    initialValue: [] as ClassMember[],
  });
  assignments = toSignal(this.classroomSvc.assignments(this.classId).pipe(catchError(() => of([]))), {
    initialValue: [] as Assignment[],
  });
  progress = toSignal(this.classroomSvc.classProgress(this.classId).pipe(catchError(() => of([]))), {
    initialValue: [] as ClassProgress[],
  });
  submissions = toSignal(
    toObservable(this.assignments).pipe(switchMap((list) => this.classroomSvc.allSubmissions(this.classId, list))),
    { initialValue: {} as Record<string, Submission[]> }
  );

  /** Teacher's note per student; typed on screen, printed, never saved. */
  notes = signal<Record<string, string | undefined>>({});

  tracking = computed(() =>
    buildTracking({
      members: this.members(),
      progress: this.progress(),
      assignments: this.assignments(),
      submissions: this.submissions(),
      now: this.today,
    })
  );

  reports = computed(() => {
    const t = this.tracking();
    const rows = this.only ? t.rows.filter((r) => r.uid === this.only) : t.rows;
    return rows.map((row) => {
      const p = this.progress().find((x) => x.uid === row.uid);
      const topics: TopicLine[] = Object.entries(p?.topics ?? {})
        .filter(([, s]) => s.total > 0)
        .map(([key, s]) => ({ key, label: s.label, subject: s.subject, total: s.total, pct: Math.round((s.correct / s.total) * 100) }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 12);
      const strong = topics.filter((x) => x.pct >= 75 && x.total >= 5).slice(0, 3);
      const practice = [...topics].filter((x) => x.pct < 60 && x.total >= 5).sort((a, b) => a.pct - b.pct).slice(0, 3);
      const homework = this.assignments().map((a) => {
        const sub = (this.submissions()[a.id] ?? []).find((s) => s.uid === row.uid) ?? null;
        const status = sub ? 'done' : a.dueAt && a.dueAt < this.today ? 'overdue' : 'pending';
        return { assignment: a, submission: sub, status };
      });
      return { row, topics, strong, practice, homework, activities: p?.activities ?? 0 };
    });
  });

  setNote(uid: string, text: string) {
    this.notes.update((n) => ({ ...n, [uid]: text }));
  }

  stars(n: number): string {
    return '★'.repeat(n) + '☆'.repeat(3 - n);
  }

  print() {
    window.print();
  }
}
