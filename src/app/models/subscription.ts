import type { AppUser } from './user';

/**
 * Abonelik modeli (SaaS tarzı).
 *
 * Bugün abonelikleri yönetici panelden elle verir (subscriptionSource =
 * 'manual'). Gerçek ödeme sağlayıcısı (iyzico / PayTR / Stripe) bağlandığında
 * sağlayıcının webhook'u bir Cloud Function'a gelir ve aynı users/{uid}
 * alanlarını Admin SDK ile yazar; panel ve uygulama değişmeden çalışır.
 */
export type PlanId = 'free' | 'pro' | 'vip';
export type BillingPeriod = 'monthly' | 'yearly';
export type SubscriptionStatusValue = AppUser['subscriptionStatus'];
export type SubscriptionSource = 'manual' | 'iyzico' | 'paytr' | 'stripe';

export interface PlanInfo {
  id: PlanId;
  label: string;
  /** TL, fiyatlandırma sayfasıyla aynı. */
  monthlyPrice: number;
  yearlyPrice: number;
}

export const PLANS: Record<PlanId, PlanInfo> = {
  free: { id: 'free', label: 'Ücretsiz', monthlyPrice: 0, yearlyPrice: 0 },
  pro: { id: 'pro', label: 'Pro Öğrenci', monthlyPrice: 99, yearlyPrice: 790 },
  vip: { id: 'vip', label: 'VIP Sınav Hazırlık', monthlyPrice: 199, yearlyPrice: 1490 },
};

export const PAID_PLANS: PlanId[] = ['pro', 'vip'];

export const STATUS_LABELS: Record<SubscriptionStatusValue, string> = {
  active: 'Aktif',
  trial: 'Deneme',
  expired: 'Süresi doldu',
  none: 'Abonelik yok',
};

export const DAY_MS = 24 * 60 * 60 * 1000;

type SubFields = Pick<
  AppUser,
  'subscriptionStatus' | 'subscriptionExpiresAt' | 'subscriptionPlan' | 'subscriptionPeriod'
>;

/**
 * The status that is actually true right now: an active or trial
 * subscription whose end date has passed counts as expired even before
 * anyone updates the document.
 */
export function effectiveStatus(u: SubFields | null | undefined, now = Date.now()): SubscriptionStatusValue {
  const status = u?.subscriptionStatus ?? 'none';
  if ((status === 'active' || status === 'trial') && u?.subscriptionExpiresAt && u.subscriptionExpiresAt < now) {
    return 'expired';
  }
  return status;
}

/** Plan the user can use right now ('free' unless active or in trial). */
export function effectivePlan(u: SubFields | null | undefined, now = Date.now()): PlanId {
  const s = effectiveStatus(u, now);
  if (s !== 'active' && s !== 'trial') return 'free';
  // Accounts made "active" before plans existed were Pro.
  return u?.subscriptionPlan && u.subscriptionPlan !== 'free' ? u.subscriptionPlan : 'pro';
}

export function hasPremium(u: SubFields | null | undefined, now = Date.now()): boolean {
  return effectivePlan(u, now) !== 'free';
}

/** Monthly recurring revenue this user brings (TL); trials bring nothing. */
export function monthlyRevenue(u: SubFields | null | undefined, now = Date.now()): number {
  if (effectiveStatus(u, now) !== 'active') return 0;
  const plan = PLANS[effectivePlan(u, now)];
  return u?.subscriptionPeriod === 'yearly' ? plan.yearlyPrice / 12 : plan.monthlyPrice;
}

/** Whole days left until the subscription ends (negative when already past). */
export function daysLeft(u: SubFields | null | undefined, now = Date.now()): number | null {
  if (!u?.subscriptionExpiresAt) return null;
  return Math.ceil((u.subscriptionExpiresAt - now) / DAY_MS);
}

/** One line of a user's subscription history, written by the admin panel (or later a webhook). */
export interface SubscriptionEvent {
  id: string;
  uid: string;
  email: string;
  type: 'plan' | 'trial' | 'extend' | 'cancel' | 'suspend' | 'unsuspend' | 'role' | 'verify';
  summary: string;
  byUid: string;
  byName: string;
  at: number;
}

/** Future provider-side record (iyzico/Stripe), kept for when payments go live. */
export type SubscriptionPlan = 'aylik' | 'yillik';
export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'expired';

export interface Subscription {
  id: string;
  userId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  provider: 'iyzico' | 'stripe';
  providerSubscriptionId: string;
  startedAt: number;
  currentPeriodEnd: number;
  canceledAt?: number;
  priceAmount: number;
  currency: 'TRY' | 'USD';
}
