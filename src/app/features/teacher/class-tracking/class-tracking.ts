import { Component, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap } from 'rxjs';
import { ClassroomService } from '../../../core/services/classroom';
import {
  ClassTracking,
  StudentFlag,
  StudentRow,
  TopicColumn,
  buildTracking,
  masteryLevel,
  trackingCsv,
} from '../../../core/tracking';
import { Assignment, ClassMember, ClassProgress, Classroom, Submission } from '../../../models/classroom';

type SortKey = 'name' | 'success' | 'active' | 'overdue';

const FLAG_LABELS: Record<StudentFlag, string> = {
  never: 'Hiç çözmedi',
  inactive: '7+ gündür yok',
  low: 'Başarı düşük',
  overdue: 'Geciken ödev',
};

/** "Takip" tab of a class: summary, student table, topic heat map, CSV. */
@Component({
  selector: 'app-class-tracking',
  imports: [DatePipe],
  templateUrl: './class-tracking.html',
  styleUrl: './class-tracking.scss',
})
export class ClassTrackingComponent {
  private classroomSvc = inject(ClassroomService);

  classroom = input.required<Classroom>();
  members = input.required<ClassMember[]>();
  assignments = input.required<Assignment[]>();

  readonly flagLabels = FLAG_LABELS;
  readonly level = masteryLevel;

  private progress = toSignal(
    toObservable(this.classroom).pipe(
      switchMap((c) => this.classroomSvc.classProgress(c.id).pipe(catchError(() => of([] as ClassProgress[]))))
    ),
    { initialValue: [] as ClassProgress[] }
  );
  private submissions = toSignal(
    toObservable(computed(() => ({ c: this.classroom(), list: this.assignments() }))).pipe(
      switchMap(({ c, list }) => this.classroomSvc.allSubmissions(c.id, list))
    ),
    { initialValue: {} as Record<string, Submission[]> }
  );

  tracking = computed<ClassTracking>(() =>
    buildTracking({
      members: this.members(),
      progress: this.progress(),
      assignments: this.assignments(),
      submissions: this.submissions(),
      now: Date.now(),
    })
  );

  sortKey = signal<SortKey>('name');
  onlyFlagged = signal(false);
  selectedUid = signal<string | null>(null);

  rows = computed(() => {
    let rows = [...this.tracking().rows];
    if (this.onlyFlagged()) rows = rows.filter((r) => r.flags.length > 0);
    switch (this.sortKey()) {
      case 'success':
        rows.sort((a, b) => (a.successPct ?? -1) - (b.successPct ?? -1));
        break;
      case 'active':
        rows.sort((a, b) => (a.lastActiveAt ?? 0) - (b.lastActiveAt ?? 0));
        break;
      case 'overdue':
        rows.sort((a, b) => b.overdue - a.overdue);
        break;
    }
    return rows;
  });
  flaggedCount = computed(() => this.tracking().rows.filter((r) => r.flags.length > 0).length);

  selected = computed(() => this.tracking().rows.find((r) => r.uid === this.selectedUid()) ?? null);
  selectedTopics = computed(() => {
    const uid = this.selectedUid();
    const topics = this.progress().find((p) => p.uid === uid)?.topics ?? {};
    return Object.entries(topics)
      .filter(([, t]) => t.total > 0)
      .map(([key, t]) => ({ key, label: t.label, subject: t.subject, total: t.total, pct: Math.round((t.correct / t.total) * 100) }))
      .sort((a, b) => a.pct - b.pct);
  });
  selectedAssignments = computed(() => {
    const row = this.selected();
    if (!row) return [];
    const now = Date.now();
    return this.assignments().map((a) => {
      const sub = (this.submissions()[a.id] ?? []).find((s) => s.uid === row.uid) ?? null;
      const status: 'done' | 'overdue' | 'pending' = sub ? 'done' : a.dueAt && a.dueAt < now ? 'overdue' : 'pending';
      return { assignment: a, submission: sub, status };
    });
  });

  cell(row: StudentRow, col: TopicColumn) {
    return row.topics[col.key] ?? null;
  }

  lastSeen(row: StudentRow): string {
    if (row.daysInactive === null) return '—';
    if (row.daysInactive === 0) return 'Bugün';
    if (row.daysInactive === 1) return 'Dün';
    return `${row.daysInactive} gün önce`;
  }

  stars(n: number): string {
    return '★'.repeat(n) + '☆'.repeat(3 - n);
  }

  downloadCsv() {
    const csv = trackingCsv(this.tracking());
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const day = new Date().toISOString().slice(0, 10);
    const name = this.classroom().name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'sinif';
    a.href = url;
    a.download = `${name}-takip-${day}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
