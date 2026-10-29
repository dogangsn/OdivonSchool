import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { FirestoreService } from '../../../core/services/firestore';
import { toCsv } from '../../../core/admin-metrics';
import { isStudentAccountEmail } from '../../../core/student-accounts';
import { AppUser, isStudent, roleLabel } from '../../../models/user';
import {
  PLANS,
  PlanId,
  STATUS_LABELS,
  SubscriptionStatusValue,
  daysLeft,
  effectivePlan,
  effectiveStatus,
} from '../../../models/subscription';
import { AdminNav } from '../admin-nav/admin-nav';

type RoleFilter = 'all' | 'student' | 'teacher' | 'admin';
type StatusFilter = 'all' | SubscriptionStatusValue | 'askida';
type SortKey = 'newest' | 'lastSeen' | 'name' | 'expires';

const LEVEL_LABELS: Record<string, string> = { ilkokul: 'İlkokul', ortaokul: 'Ortaokul', lise: 'Lise', kpss: 'KPSS' };
const PAGE = 100;

@Component({
  selector: 'app-subscriber-list',
  imports: [RouterLink, DatePipe, AdminNav],
  templateUrl: './subscriber-list.html',
  styleUrl: './subscriber-list.scss',
})
export class SubscriberList {
  readonly roleLabel = roleLabel;
  readonly plans = PLANS;
  readonly statusLabels = STATUS_LABELS;
  readonly effectiveStatus = effectiveStatus;
  readonly effectivePlan = effectivePlan;
  readonly daysLeft = daysLeft;
  readonly isStudentAccountEmail = isStudentAccountEmail;

  private firestoreSvc = inject(FirestoreService);
  private route = inject(ActivatedRoute);

  users = toSignal(this.firestoreSvc.allUsers(), { initialValue: [] as AppUser[] });

  search = signal('');
  role = signal<RoleFilter>('all');
  status = signal<StatusFilter>((this.route.snapshot.queryParamMap.get('durum') as StatusFilter) || 'all');
  plan = signal<'all' | PlanId>('all');
  level = signal<string>('all');
  sort = signal<SortKey>('newest');
  shown = signal(PAGE);

  /** Counts on the status chips, for the current role filter. */
  statusCounts = computed(() => {
    const c: Record<StatusFilter, number> = { all: 0, active: 0, trial: 0, expired: 0, none: 0, askida: 0 };
    for (const u of this.users()) {
      if (!this.matchesRole(u)) continue;
      c.all++;
      c[effectiveStatus(u)]++;
      if (u.suspended) c.askida++;
    }
    return c;
  });

  readonly statusChips: { id: StatusFilter; label: string }[] = [
    { id: 'all', label: 'Tümü' },
    { id: 'active', label: 'Aktif' },
    { id: 'trial', label: 'Deneme' },
    { id: 'expired', label: 'Süresi doldu' },
    { id: 'none', label: 'Abonelik yok' },
    { id: 'askida', label: 'Askıda' },
  ];

  filtered = computed(() => {
    const term = this.search().toLocaleLowerCase('tr').trim();
    const status = this.status();
    const plan = this.plan();
    const level = this.level();
    const list = this.users().filter((u) => {
      if (!this.matchesRole(u)) return false;
      if (status === 'askida' ? !u.suspended : status !== 'all' && effectiveStatus(u) !== status) return false;
      if (plan !== 'all' && effectivePlan(u) !== plan) return false;
      if (level !== 'all' && u.gradeLevel !== level) return false;
      if (term) {
        const hay = `${u.displayName ?? ''} ${u.email ?? ''} ${u.username ?? ''} ${u.school ?? ''} ${u.uid}`.toLocaleLowerCase('tr');
        if (!hay.includes(term)) return false;
      }
      return true;
    });

    const sort = this.sort();
    return list.sort((a, b) => {
      switch (sort) {
        case 'lastSeen':
          return (b.lastSeenAt ?? 0) - (a.lastSeenAt ?? 0);
        case 'name':
          return (a.displayName || a.email || '').localeCompare(b.displayName || b.email || '', 'tr');
        case 'expires':
          return (a.subscriptionExpiresAt ?? Infinity) - (b.subscriptionExpiresAt ?? Infinity);
        default:
          return (b.createdAt ?? 0) - (a.createdAt ?? 0);
      }
    });
  });

  visible = computed(() => this.filtered().slice(0, this.shown()));

  private matchesRole(u: AppUser): boolean {
    switch (this.role()) {
      case 'student':
        return isStudent(u);
      case 'teacher':
        return u.role === 'teacher';
      case 'admin':
        return u.role === 'admin';
      default:
        return true;
    }
  }

  setFilter<T>(sig: { set(v: T): void }, value: T) {
    sig.set(value);
    this.shown.set(PAGE);
  }

  showMore() {
    this.shown.update((n) => n + PAGE);
  }

  levelLabel(u: AppUser): string {
    if (u.role === 'teacher') return u.branch || '—';
    if (u.grade) return `${u.grade}. sınıf`;
    return u.gradeLevel ? LEVEL_LABELS[u.gradeLevel] : '—';
  }

  statusClass(u: AppUser): string {
    switch (effectiveStatus(u)) {
      case 'active':
        return 'green';
      case 'trial':
        return 'amber';
      case 'expired':
        return 'red';
      default:
        return '';
    }
  }

  exportCsv() {
    const fmt = (ms?: number) => (ms ? new Date(ms).toLocaleDateString('tr-TR') : '');
    const rows: (string | number | undefined)[][] = [
      ['Ad', 'E-posta', 'Rol', 'Kademe', 'Sınıf', 'Plan', 'Durum', 'Dönem', 'Bitiş', 'Kayıt', 'Son görülme', 'Askıda', 'UID'],
      ...this.filtered().map((u) => [
        u.displayName,
        u.email,
        roleLabel(u.role),
        u.gradeLevel ? LEVEL_LABELS[u.gradeLevel] : '',
        u.grade ?? '',
        PLANS[effectivePlan(u)].label,
        STATUS_LABELS[effectiveStatus(u)],
        u.subscriptionPeriod === 'yearly' ? 'Yıllık' : u.subscriptionPeriod === 'monthly' ? 'Aylık' : '',
        fmt(u.subscriptionExpiresAt),
        fmt(u.createdAt),
        fmt(u.lastSeenAt),
        u.suspended ? 'Evet' : '',
        u.uid,
      ]),
    ];
    const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `odivon-kullanicilar-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
}
