import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * PayTR iFrame API helpers that need no Firebase, so they can be tested.
 * Docs: https://dev.paytr.com/iframe-api
 */

export type PaidPlan = 'pro' | 'vip';
export type Period = 'monthly' | 'yearly';

/** TL, must match src/app/models/subscription.ts PLANS and the pricing page. */
export const PRICES: Record<PaidPlan, { label: string; monthly: number; yearly: number }> = {
  pro: { label: 'Pro Öğrenci', monthly: 99, yearly: 790 },
  vip: { label: 'VIP Sınav Hazırlık', monthly: 199, yearly: 1490 },
};

export function isPaidPlan(v: unknown): v is PaidPlan {
  return v === 'pro' || v === 'vip';
}
export function isPeriod(v: unknown): v is Period {
  return v === 'monthly' || v === 'yearly';
}

export function priceTl(plan: PaidPlan, period: Period): number {
  return PRICES[plan][period];
}

/** PayTR wants the amount in kuruş as an integer (99.00 TL -> 9900). */
export function priceKurus(plan: PaidPlan, period: Period): number {
  return Math.round(priceTl(plan, period) * 100);
}

export function basketFor(plan: PaidPlan, period: Period): string {
  const name = `${PRICES[plan].label} - ${period === 'yearly' ? '1 yıllık' : '1 aylık'} üyelik`;
  return Buffer.from(JSON.stringify([[name, priceTl(plan, period).toFixed(2), 1]])).toString('base64');
}

/** merchant_oid must be letters/digits only (no dashes), at most 64 chars. */
export function makeMerchantOid(now = Date.now(), rand = Math.random): string {
  let suffix = '';
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let i = 0; i < 6; i++) suffix += chars[Math.floor(rand() * chars.length)];
  return `OS${now}${suffix}`;
}

function hmacB64(data: string, key: string): string {
  return createHmac('sha256', key).update(data).digest('base64');
}

export interface TokenFields {
  merchant_id: string;
  user_ip: string;
  merchant_oid: string;
  email: string;
  payment_amount: string;
  user_basket: string;
  no_installment: string;
  max_installment: string;
  currency: string;
  test_mode: string;
}

/** paytr_token for the get-token request. */
export function tokenHash(f: TokenFields, merchantKey: string, merchantSalt: string): string {
  const s =
    f.merchant_id + f.user_ip + f.merchant_oid + f.email + f.payment_amount + f.user_basket +
    f.no_installment + f.max_installment + f.currency + f.test_mode;
  return hmacB64(s + merchantSalt, merchantKey);
}

/** Expected hash of PayTR's callback (bildirim URL) POST. */
export function callbackHash(
  b: { merchant_oid: string; status: string; total_amount: string },
  merchantKey: string,
  merchantSalt: string
): string {
  return hmacB64(b.merchant_oid + merchantSalt + b.status + b.total_amount, merchantKey);
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** First address in X-Forwarded-For (the browser), else the socket address. */
export function clientIp(forwardedFor: string | string[] | undefined, fallback: string | undefined): string {
  const raw = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  const first = raw?.split(',')[0]?.trim();
  return (first || fallback || '127.0.0.1').replace(/^::ffff:/, '').slice(0, 39);
}

/** Adds whole calendar months (Turkey time is irrelevant at day precision). */
export function addMonths(from: number, months: number): number {
  const d = new Date(from);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d.getTime();
}

/**
 * New end date after a paid period. A still-running paid subscription is
 * extended from its end date, so buying early never loses days.
 */
export function newExpiry(
  current: { subscriptionStatus?: string; subscriptionExpiresAt?: number } | undefined,
  period: Period,
  now = Date.now()
): number {
  const running =
    (current?.subscriptionStatus === 'active' || current?.subscriptionStatus === 'trial') &&
    (current.subscriptionExpiresAt ?? 0) > now;
  const from = running && current?.subscriptionStatus === 'active' ? current.subscriptionExpiresAt! : now;
  return addMonths(from, period === 'yearly' ? 12 : 1);
}
