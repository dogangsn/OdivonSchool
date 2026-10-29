import { AppUser } from '../models/user';
import { effectivePlan, effectiveStatus, monthlyRevenue } from '../models/subscription';
import { saasMetrics, signupsPerDay, toCsv } from './admin-metrics';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date(2026, 9, 29, 12, 0).getTime();

function user(uid: string, overrides: Partial<AppUser> = {}): AppUser {
  return {
    uid,
    email: `${uid}@ornek.com`,
    displayName: uid,
    role: 'student',
    createdAt: NOW - 60 * DAY,
    subscriptionStatus: 'none',
    ...overrides,
  };
}

describe('subscription helpers', () => {
  it('treats a passed end date as expired', () => {
    const u = user('a', { subscriptionStatus: 'active', subscriptionPlan: 'vip', subscriptionExpiresAt: NOW - 1 });
    expect(effectiveStatus(u, NOW)).toBe('expired');
    expect(effectivePlan(u, NOW)).toBe('free');
    expect(monthlyRevenue(u, NOW)).toBe(0);
  });

  it('counts legacy active accounts without a plan as Pro', () => {
    const u = user('a', { subscriptionStatus: 'active' });
    expect(effectivePlan(u, NOW)).toBe('pro');
    expect(monthlyRevenue(u, NOW)).toBe(99);
  });

  it('spreads a yearly price over 12 months and ignores trials', () => {
    const yearly = user('a', {
      subscriptionStatus: 'active',
      subscriptionPlan: 'vip',
      subscriptionPeriod: 'yearly',
      subscriptionExpiresAt: NOW + 100 * DAY,
    });
    expect(monthlyRevenue(yearly, NOW)).toBeCloseTo(1490 / 12);
    const trial = user('b', { subscriptionStatus: 'trial', subscriptionPlan: 'pro', subscriptionExpiresAt: NOW + DAY });
    expect(monthlyRevenue(trial, NOW)).toBe(0);
  });
});

describe('saasMetrics', () => {
  it('adds up roles, plans, activity and revenue', () => {
    const m = saasMetrics(
      [
        user('s1', { createdAt: NOW - 2 * DAY, lastSeenAt: NOW - 1000 }),
        user('s2', { subscriptionStatus: 'active', subscriptionPlan: 'pro', lastSeenAt: NOW - 3 * DAY }),
        user('s3', { subscriptionStatus: 'trial', subscriptionPlan: 'vip', subscriptionExpiresAt: NOW + 2 * DAY }),
        user('s4', { subscriptionStatus: 'active', subscriptionExpiresAt: NOW - DAY }),
        user('t1', { role: 'teacher', createdAt: NOW - 20 * DAY }),
        user('ad', { role: 'admin', suspended: false }),
      ],
      NOW
    );
    expect(m.total).toBe(6);
    expect(m.students).toBe(4);
    expect(m.teachers).toBe(1);
    expect(m.admins).toBe(1);
    expect(m.newLast7).toBe(1);
    expect(m.newLast30).toBe(2);
    expect(m.activeToday).toBe(1);
    expect(m.active7).toBe(2);
    expect(m.paying).toBe(1);
    expect(m.trials).toBe(1);
    expect(m.trialsEndingSoon.map((u) => u.uid)).toEqual(['s3']);
    expect(m.lapsed.map((u) => u.uid)).toEqual(['s4']);
    expect(m.byPlan).toEqual({ free: 4, pro: 1, vip: 1 });
    expect(m.mrr).toBe(99);
    expect(m.unverifiedTeachers.length).toBe(1);
    expect(m.conversion).toBe(20);
  });
});

describe('signupsPerDay', () => {
  it('buckets sign-ups by local day, oldest first', () => {
    const days = signupsPerDay(
      [{ createdAt: NOW }, { createdAt: NOW - 1000 }, { createdAt: NOW - DAY }, { createdAt: NOW - 40 * DAY }],
      7,
      NOW
    );
    expect(days.length).toBe(7);
    expect(days[6].count).toBe(2);
    expect(days[5].count).toBe(1);
    expect(days.reduce((s, d) => s + d.count, 0)).toBe(3);
  });
});

describe('toCsv', () => {
  it('quotes cells with separators and starts with a BOM', () => {
    const csv = toCsv([['ad', 'not'], ['Ali; Veli', 'dedi "merhaba"']]);
    expect(csv.startsWith('﻿')).toBeTrue();
    expect(csv).toContain('"Ali; Veli";"dedi ""merhaba"""');
  });
});
