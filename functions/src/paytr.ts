import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret, defineString } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import * as admin from 'firebase-admin';
import { defaultAppUrl } from './notifyLogic';
import {
  PRICES,
  basketFor,
  callbackHash,
  clientIp,
  isPaidPlan,
  isPeriod,
  makeMerchantOid,
  newExpiry,
  priceKurus,
  safeEqual,
  tokenHash,
} from './paytrLogic';

/**
 * PayTR iFrame API.
 *
 * 1. paytrStart (callable): the signed-in user picks a plan; the price is
 *    taken from the server table, a payments/{merchantOid} doc is written
 *    and a PayTR iframe token is returned. Card details are typed into
 *    PayTR's own iframe, never into our site.
 * 2. paytrCallback (HTTP, "Bildirim URL" in the PayTR panel): PayTR posts the
 *    result; the hash is verified and, on success, users/{uid} gets the same
 *    subscription fields the admin panel writes (subscriptionSource 'paytr').
 *
 * Secrets: firebase functions:secrets:set PAYTR_MERCHANT_ID / _KEY / _SALT
 * PAYTR_TEST_MODE (functions/.env): '1' while testing, '0' when live.
 */
const merchantId = defineSecret('PAYTR_MERCHANT_ID');
const merchantKey = defineSecret('PAYTR_MERCHANT_KEY');
const merchantSalt = defineSecret('PAYTR_MERCHANT_SALT');
const testMode = defineString('PAYTR_TEST_MODE', { default: '1' });

const SECRETS = [merchantId, merchantKey, merchantSalt];
const GET_TOKEN_URL = 'https://www.paytr.com/odeme/api/get-token';

interface StartRequest {
  plan?: unknown;
  period?: unknown;
  phone?: unknown;
  address?: unknown;
}

function cleanText(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

export const paytrStart = onCall({ secrets: SECRETS, maxInstances: 10 }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Ödeme için giriş yapmalısın.');

  const id = merchantId.value();
  const key = merchantKey.value();
  const salt = merchantSalt.value();
  if (!id || !key || !salt) {
    throw new HttpsError('failed-precondition', 'PayTR mağaza bilgileri henüz girilmedi.');
  }

  const { plan, period, phone, address } = (request.data ?? {}) as StartRequest;
  if (!isPaidPlan(plan) || !isPeriod(period)) throw new HttpsError('invalid-argument', 'Geçersiz paket.');
  const phoneClean = cleanText(phone, 20).replace(/[^\d+]/g, '');
  if (phoneClean.replace(/\D/g, '').length < 10) {
    throw new HttpsError('invalid-argument', 'Lütfen geçerli bir telefon numarası gir.');
  }

  const db = admin.firestore();
  const userSnap = await db.doc(`users/${uid}`).get();
  const user = userSnap.data() ?? {};
  const email: string = (user.email as string) || request.auth?.token.email || '';
  if (!email || !email.includes('@')) {
    throw new HttpsError('failed-precondition', 'Ödeme için hesabında geçerli bir e-posta adresi olmalı.');
  }
  if (user.suspended) throw new HttpsError('permission-denied', 'Hesabın askıya alınmış.');

  const raw = request.rawRequest;
  const fields = {
    merchant_id: id,
    user_ip: clientIp(raw.headers['x-forwarded-for'], raw.ip),
    merchant_oid: makeMerchantOid(),
    email: email.slice(0, 100),
    payment_amount: String(priceKurus(plan, period)),
    user_basket: basketFor(plan, period),
    no_installment: '1',
    max_installment: '0',
    currency: 'TL',
    test_mode: testMode.value() === '0' ? '0' : '1',
  };
  const appUrl = defaultAppUrl();
  const body = new URLSearchParams({
    ...fields,
    paytr_token: tokenHash(fields, key, salt),
    debug_on: fields.test_mode,
    user_name: (cleanText(user.displayName, 60) || email).slice(0, 60),
    user_address: cleanText(address, 400) || 'Türkiye',
    user_phone: phoneClean,
    merchant_ok_url: `${appUrl}/odeme/sonuc?durum=basarili`,
    merchant_fail_url: `${appUrl}/odeme/sonuc?durum=basarisiz`,
    timeout_limit: '30',
    lang: 'tr',
  });

  await db.doc(`payments/${fields.merchant_oid}`).set({
    uid,
    email,
    plan,
    period,
    amount: priceKurus(plan, period) / 100,
    currency: 'TRY',
    provider: 'paytr',
    status: 'pending',
    testMode: fields.test_mode === '1',
    createdAt: Date.now(),
  });

  const res = await fetch(GET_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = (await res.json().catch(() => ({}))) as { status?: string; token?: string; reason?: string };
  if (json.status !== 'success' || !json.token) {
    logger.error('PayTR get-token failed', { status: res.status, reason: json.reason });
    await db.doc(`payments/${fields.merchant_oid}`).update({ status: 'failed', failedReason: json.reason ?? 'token' });
    throw new HttpsError('unavailable', `Ödeme sayfası açılamadı: ${json.reason ?? 'PayTR yanıt vermedi'}`);
  }
  return { token: json.token, merchantOid: fields.merchant_oid };
});

export const paytrCallback = onRequest({ secrets: SECRETS, maxInstances: 10 }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('POST');
    return;
  }
  const b = (req.body ?? {}) as Record<string, string>;
  const oid = String(b.merchant_oid ?? '');
  const status = String(b.status ?? '');
  const totalAmount = String(b.total_amount ?? '');
  const expected = callbackHash({ merchant_oid: oid, status, total_amount: totalAmount }, merchantKey.value(), merchantSalt.value());
  if (!oid || !safeEqual(String(b.hash ?? ''), expected)) {
    logger.warn('PayTR callback with bad hash', { oid });
    res.status(400).send('PAYTR notification failed: bad hash');
    return;
  }

  const db = admin.firestore();
  const payRef = db.doc(`payments/${oid}`);
  await db.runTransaction(async (tx) => {
    const paySnap = await tx.get(payRef);
    if (!paySnap.exists) {
      logger.error('PayTR callback for unknown order', { oid });
      return;
    }
    const pay = paySnap.data()!;
    // PayTR may send the same notification more than once.
    if (pay.status === 'success' || pay.status === 'failed_final') return;

    const now = Date.now();
    if (status !== 'success') {
      tx.update(payRef, {
        status: 'failed_final',
        failedReasonCode: String(b.failed_reason_code ?? ''),
        failedReason: String(b.failed_reason_msg ?? '').slice(0, 300),
        updatedAt: now,
      });
      return;
    }

    const plan = pay.plan;
    const period = pay.period;
    if (!isPaidPlan(plan) || !isPeriod(period)) {
      logger.error('PayTR payment doc has bad plan', { oid });
      return;
    }
    const paid = Number(b.payment_amount ?? totalAmount);
    if (Number.isFinite(paid) && paid < priceKurus(plan, period)) {
      logger.error('PayTR paid amount lower than price', { oid, paid });
      tx.update(payRef, { status: 'amount_mismatch', totalAmount: Number(totalAmount), updatedAt: now });
      return;
    }

    const userRef = db.doc(`users/${pay.uid}`);
    const userSnap = await tx.get(userRef);
    const user = userSnap.data() ?? {};
    const expiresAt = newExpiry(user, period, now);
    const keepStart = user.subscriptionStatus === 'active' && (user.subscriptionExpiresAt ?? 0) > now;

    tx.update(payRef, {
      status: 'success',
      totalAmount: Number(totalAmount) / 100,
      paymentType: String(b.payment_type ?? ''),
      paidAt: now,
      expiresAt,
      updatedAt: now,
    });
    tx.set(
      userRef,
      {
        subscriptionStatus: 'active',
        subscriptionPlan: plan,
        subscriptionPeriod: period,
        subscriptionSource: 'paytr',
        subscriptionId: oid,
        subscriptionExpiresAt: expiresAt,
        subscriptionStartedAt: keepStart ? user.subscriptionStartedAt ?? now : now,
      },
      { merge: true }
    );
    const endText = new Date(expiresAt).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' });
    tx.set(db.collection('subscriptionEvents').doc(), {
      uid: pay.uid,
      email: pay.email ?? '',
      type: 'plan',
      summary: `PayTR ödemesi: ${PRICES[plan].label} ${period === 'yearly' ? 'yıllık' : 'aylık'} ₺${pay.amount}${pay.testMode ? ' (test)' : ''} → bitiş ${endText}`.slice(0, 300),
      byUid: 'paytr',
      byName: 'PayTR',
      at: now,
    });
  });

  res.set('Content-Type', 'text/plain');
  res.send('OK');
});
