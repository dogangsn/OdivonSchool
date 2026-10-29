import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { FirestoreService } from '../../../core/services/firestore';
import { AdminService } from '../../../core/services/admin';
import { saasMetrics, signupsPerDay } from '../../../core/admin-metrics';
import { DAY_MS, PLANS, daysLeft } from '../../../models/subscription';
import { AppUser } from '../../../models/user';
import { AdminNav } from '../admin-nav/admin-nav';

@Component({
  selector: 'app-admin-dashboard',
  imports: [RouterLink, DecimalPipe, AdminNav],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class AdminDashboard {
  private firestoreSvc = inject(FirestoreService);
  private admin = inject(AdminService);
  readonly plans = PLANS;
  readonly daysLeft = daysLeft;

  users = toSignal(this.firestoreSvc.allUsers(), { initialValue: [] as AppUser[] });
  attempts = toSignal(this.firestoreSvc.allAttempts(), { initialValue: [] });

  metrics = computed(() => saasMetrics(this.users()));

  signups = computed(() => signupsPerDay(this.users(), 30));
  signupMax = computed(() => Math.max(1, ...this.signups().map((d) => d.count)));

  planBars = computed(() => {
    const p = this.metrics().byPlan;
    const total = Math.max(1, p.free + p.pro + p.vip);
    return [
      { label: PLANS.free.label, value: p.free, pct: (p.free / total) * 100, color: 'var(--border-strong)' },
      { label: PLANS.pro.label, value: p.pro, pct: (p.pro / total) * 100, color: 'var(--primary)' },
      { label: PLANS.vip.label, value: p.vip, pct: (p.vip / total) * 100, color: 'var(--accent)' },
    ];
  });

  levelBars = computed(() => {
    const counts: Record<string, number> = { ilkokul: 0, ortaokul: 0, lise: 0, kpss: 0 };
    for (const u of this.users()) {
      if (u.role === 'teacher' || u.role === 'admin') continue;
      if (u.gradeLevel && u.gradeLevel in counts) counts[u.gradeLevel]++;
    }
    const max = Math.max(1, ...Object.values(counts));
    const names: Record<string, string> = { ilkokul: 'İlkokul', ortaokul: 'Ortaokul', lise: 'Lise', kpss: 'KPSS' };
    return Object.entries(counts).map(([k, v]) => ({ label: names[k], value: v, pct: (v / max) * 100 }));
  });

  /** Tests solved in the last 7 days (from the latest 500 attempts). */
  attempts7 = computed(() => {
    const since = Date.now() - 7 * DAY_MS;
    return this.attempts().filter((a) => (a.completedAt ?? a.startedAt ?? 0) >= since).length;
  });

  overallSuccessRate = computed(() => {
    const list = this.attempts();
    const totalQuestions = list.reduce((sum, a) => sum + a.totalCount, 0);
    const totalCorrect = list.reduce((sum, a) => sum + a.correctCount, 0);
    return totalQuestions ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
  });

  pool = signal<{ approved: number; draft: number; teacherDrafts: number } | null>(null);

  constructor() {
    this.admin.poolTotals().then(
      (t) => this.pool.set(t),
      () => this.pool.set(null)
    );
  }

  /** Short Turkish day label for the chart axis, e.g. "29 Eki". */
  dayLabel(key: string): string {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  }
}
