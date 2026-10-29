import { Component, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Auth } from '@angular/fire/auth';
import { catchError, of } from 'rxjs';
import { FirestoreService } from '../../../core/services/firestore';
import { AdminNote, AdminService, UserPatch } from '../../../core/services/admin';
import { dayKey } from '../../../core/admin-metrics';
import { isStudentAccountEmail } from '../../../core/student-accounts';
import { AppUser, UserRole, roleLabel } from '../../../models/user';
import {
  BillingPeriod,
  DAY_MS,
  PLANS,
  PlanId,
  STATUS_LABELS,
  SubscriptionEvent,
  daysLeft,
  effectivePlan,
  effectiveStatus,
} from '../../../models/subscription';
import { TestAttempt } from '../../../models/test-attempt';
import { AdminNav } from '../admin-nav/admin-nav';

type Msg = { type: 'success' | 'danger'; text: string } | null;

/** End of the given local day (YYYY-MM-DD), so "bitiş 30.11" lasts all of that day. */
function endOfDay(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59).getTime();
}

function addMonths(ms: number, months: number): number {
  const d = new Date(ms);
  d.setMonth(d.getMonth() + months);
  return d.getTime();
}

const fmt = (ms: number) => new Date(ms).toLocaleDateString('tr-TR');

@Component({
  selector: 'app-subscriber-detail',
  imports: [RouterLink, DatePipe, AdminNav],
  templateUrl: './subscriber-detail.html',
  styleUrl: './subscriber-detail.scss',
})
export class SubscriberDetail {
  readonly roleLabel = roleLabel;
  readonly plans = PLANS;
  readonly statusLabels = STATUS_LABELS;
  readonly isStudentAccountEmail = isStudentAccountEmail;

  private route = inject(ActivatedRoute);
  private firestoreSvc = inject(FirestoreService);
  private admin = inject(AdminService);
  private auth = inject(Auth);

  userId = this.route.snapshot.paramMap.get('userId')!;
  isSelf = this.auth.currentUser?.uid === this.userId;

  user = toSignal<AppUser | null>(this.firestoreSvc.userById(this.userId), { initialValue: null });
  attempts = toSignal(
    this.firestoreSvc.attemptsForUser(this.userId).pipe(catchError(() => of([] as TestAttempt[]))),
    { initialValue: [] as TestAttempt[] }
  );

  status = computed(() => effectiveStatus(this.user()));
  plan = computed(() => effectivePlan(this.user()));
  left = computed(() => daysLeft(this.user()));

  successRate = computed(() => {
    const list = this.attempts();
    const total = list.reduce((s, a) => s + a.totalCount, 0);
    const correct = list.reduce((s, a) => s + a.correctCount, 0);
    return total ? Math.round((correct / total) * 100) : 0;
  });

  events = signal<SubscriptionEvent[]>([]);
  note = signal<AdminNote | null>(null);
  noteDraft = signal('');

  busy = signal(false);
  message = signal<Msg>(null);

  // Abonelik formu
  formPlan = signal<Exclude<PlanId, 'free'>>('pro');
  formPeriod = signal<BillingPeriod>('monthly');
  formEnd = signal(dayKey(addMonths(Date.now(), 1)));
  trialDays = signal(7);

  // Hesap
  formRole = signal<UserRole>('student');
  suspendReason = signal('');

  constructor() {
    this.loadSide();

    // Fill the forms from the user once it arrives (and after every change).
    effect(() => {
      const u = this.user();
      if (!u) return;
      const p = effectivePlan(u);
      this.formPlan.set(p === 'vip' ? 'vip' : 'pro');
      this.formPeriod.set(u.subscriptionPeriod ?? 'monthly');
      if (u.subscriptionExpiresAt && u.subscriptionExpiresAt > Date.now()) this.formEnd.set(dayKey(u.subscriptionExpiresAt));
      this.formRole.set(u.role === 'user' ? 'student' : u.role);
    });
  }

  private async loadSide() {
    try {
      const [events, note] = await Promise.all([this.admin.eventsForUser(this.userId), this.admin.noteFor(this.userId)]);
      this.events.set(events);
      this.note.set(note);
      this.noteDraft.set(note?.text ?? '');
    } catch (err) {
      console.warn('[SubscriberDetail] history/note load failed:', err);
    }
  }

  setPeriod(p: BillingPeriod) {
    this.formPeriod.set(p);
    this.formEnd.set(dayKey(addMonths(Date.now(), p === 'yearly' ? 12 : 1)));
  }

  private async run(patch: UserPatch, type: SubscriptionEvent['type'], summary: string) {
    const u = this.user();
    if (!u) return;
    this.busy.set(true);
    this.message.set(null);
    try {
      await this.admin.updateUser(u, patch, { type, summary });
      this.message.set({ type: 'success', text: `Kaydedildi: ${summary}` });
      this.events.set(await this.admin.eventsForUser(this.userId));
    } catch (err: any) {
      this.message.set({ type: 'danger', text: `Kaydedilemedi: ${err?.message ?? 'bilinmeyen hata'}` });
    } finally {
      this.busy.set(false);
    }
  }

  // ---- Abonelik ----

  saveSubscription() {
    const u = this.user();
    if (!u) return;
    const end = endOfDay(this.formEnd());
    if (!Number.isFinite(end) || end <= Date.now()) {
      this.message.set({ type: 'danger', text: 'Bitiş tarihi bugünden sonra olmalı.' });
      return;
    }
    const plan = this.formPlan();
    const period = this.formPeriod();
    const startedAt = this.status() === 'active' && u.subscriptionStartedAt ? u.subscriptionStartedAt : Date.now();
    this.run(
      {
        subscriptionStatus: 'active',
        subscriptionPlan: plan,
        subscriptionPeriod: period,
        subscriptionStartedAt: startedAt,
        subscriptionExpiresAt: end,
        subscriptionSource: 'manual',
      },
      'plan',
      `${PLANS[plan].label} (${period === 'yearly' ? 'yıllık' : 'aylık'}) aktif, bitiş ${fmt(end)}`
    );
  }

  startTrial() {
    const days = Math.round(this.trialDays());
    if (!(days >= 1 && days <= 90)) {
      this.message.set({ type: 'danger', text: 'Deneme süresi 1 ile 90 gün arasında olmalı.' });
      return;
    }
    const plan = this.formPlan();
    const end = endOfDay(dayKey(Date.now() + days * DAY_MS));
    this.run(
      {
        subscriptionStatus: 'trial',
        subscriptionPlan: plan,
        subscriptionStartedAt: Date.now(),
        subscriptionExpiresAt: end,
        subscriptionSource: 'manual',
      },
      'trial',
      `${days} günlük ${PLANS[plan].label} denemesi, bitiş ${fmt(end)}`
    );
  }

  extend(days: number) {
    const u = this.user();
    if (!u) return;
    const from = Math.max(Date.now(), u.subscriptionExpiresAt ?? 0);
    const end = endOfDay(dayKey(from + days * DAY_MS));
    const status = this.status() === 'trial' ? 'trial' : 'active';
    const patch: UserPatch = { subscriptionExpiresAt: end, subscriptionStatus: status };
    if (!u.subscriptionPlan || u.subscriptionPlan === 'free') patch.subscriptionPlan = this.formPlan();
    if (status === 'active' && this.status() !== 'active') patch.subscriptionStartedAt = Date.now();
    this.run(patch, 'extend', `${days} gün uzatıldı, yeni bitiş ${fmt(end)}`);
  }

  endNow() {
    if (!confirm('Abonelik şimdi sonlandırılsın mı? Kullanıcı ücretsiz plana düşer.')) return;
    this.run({ subscriptionStatus: 'expired', subscriptionExpiresAt: Date.now() }, 'cancel', 'Abonelik sonlandırıldı');
  }

  resetToFree() {
    if (!confirm('Abonelik bilgileri silinip kullanıcı ücretsiz plana alınsın mı?')) return;
    this.run(
      {
        subscriptionStatus: 'none',
        subscriptionPlan: null,
        subscriptionPeriod: null,
        subscriptionStartedAt: null,
        subscriptionExpiresAt: null,
        subscriptionSource: null,
      },
      'cancel',
      'Ücretsiz plana alındı'
    );
  }

  // ---- Hesap ----

  saveRole() {
    const u = this.user();
    const role = this.formRole();
    if (!u || role === u.role || (u.role === 'user' && role === 'student')) return;
    if (this.isSelf) return;
    if (role === 'admin' && !confirm(`${u.email} yönetici yapılsın mı? Panelin tamamına erişebilir.`)) return;
    this.run({ role }, 'role', `Rol: ${roleLabel(u.role)} → ${roleLabel(role)}`);
  }

  toggleTeacherVerified() {
    const u = this.user();
    if (!u) return;
    const next = !u.teacherVerified;
    this.run({ teacherVerified: next }, 'verify', next ? 'Öğretmen onaylandı' : 'Öğretmen onayı kaldırıldı');
  }

  suspend() {
    const u = this.user();
    if (!u || this.isSelf) return;
    const reason = this.suspendReason().trim().slice(0, 200);
    if (!confirm(`${u.displayName || u.email} hesabı askıya alınsın mı? Uygulamayı kullanamaz.`)) return;
    this.run(
      { suspended: true, suspendedReason: reason || null },
      'suspend',
      reason ? `Hesap askıya alındı: ${reason}` : 'Hesap askıya alındı'
    );
  }

  unsuspend() {
    this.run({ suspended: null, suspendedReason: null }, 'unsuspend', 'Askı kaldırıldı');
  }

  // ---- Not ----

  async saveNote() {
    this.busy.set(true);
    try {
      await this.admin.saveNote(this.userId, this.noteDraft().trim());
      this.note.set(await this.admin.noteFor(this.userId));
      this.message.set({ type: 'success', text: 'Not kaydedildi.' });
    } catch (err: any) {
      this.message.set({ type: 'danger', text: `Not kaydedilemedi: ${err?.message ?? ''}` });
    } finally {
      this.busy.set(false);
    }
  }

  eventIcon(type: SubscriptionEvent['type']): string {
    const icons: Record<SubscriptionEvent['type'], string> = {
      plan: '💳',
      trial: '⏳',
      extend: '➕',
      cancel: '⛔',
      suspend: '⏸️',
      unsuspend: '▶️',
      role: '🛡️',
      verify: '✅',
    };
    return icons[type] ?? '•';
  }
}
