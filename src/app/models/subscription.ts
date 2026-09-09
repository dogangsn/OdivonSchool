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
