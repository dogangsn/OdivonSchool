import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  addMonths, basketFor, callbackHash, clientIp, makeMerchantOid, newExpiry, priceKurus, safeEqual, tokenHash,
} from './paytrLogic';

test('prices are in kuruş', () => {
  assert.equal(priceKurus('pro', 'monthly'), 9900);
  assert.equal(priceKurus('vip', 'yearly'), 149000);
});

test('basket is base64 JSON with a TL price string', () => {
  const items = JSON.parse(Buffer.from(basketFor('pro', 'yearly'), 'base64').toString());
  assert.deepEqual(items[0].slice(1), ['790.00', 1]);
});

test('merchant oid is alphanumeric and short', () => {
  const oid = makeMerchantOid(1700000000000, () => 0.5);
  assert.match(oid, /^[A-Za-z0-9]{1,64}$/);
});

test('token hash follows PayTR order', () => {
  const f = {
    merchant_id: '1', user_ip: '2', merchant_oid: '3', email: '4', payment_amount: '5', user_basket: '6',
    no_installment: '7', max_installment: '8', currency: '9', test_mode: '0',
  };
  const want = createHmac('sha256', 'KEY').update('1234567890SALT').digest('base64');
  assert.equal(tokenHash(f, 'KEY', 'SALT'), want);
});

test('callback hash is oid + salt + status + total', () => {
  const want = createHmac('sha256', 'K').update('OS1Ssuccess9900').digest('base64');
  assert.equal(callbackHash({ merchant_oid: 'OS1', status: 'success', total_amount: '9900' }, 'K', 'S'), want);
  assert.ok(safeEqual(want, want));
  assert.ok(!safeEqual(want, want.slice(1)));
});

test('client ip takes the first forwarded address', () => {
  assert.equal(clientIp('85.1.2.3, 10.0.0.1', '1.1.1.1'), '85.1.2.3');
  assert.equal(clientIp(undefined, '::ffff:9.9.9.9'), '9.9.9.9');
});

test('addMonths clamps to month end', () => {
  assert.equal(new Date(addMonths(Date.UTC(2026, 0, 31), 1)).toISOString().slice(0, 10), '2026-02-28');
  assert.equal(new Date(addMonths(Date.UTC(2026, 10, 9), 12)).toISOString().slice(0, 10), '2027-11-09');
});

test('newExpiry extends a running paid subscription, not a trial', () => {
  const now = Date.UTC(2026, 10, 9);
  const end = Date.UTC(2026, 11, 1);
  assert.equal(newExpiry({ subscriptionStatus: 'active', subscriptionExpiresAt: end }, 'monthly', now), Date.UTC(2027, 0, 1));
  assert.equal(newExpiry({ subscriptionStatus: 'trial', subscriptionExpiresAt: end }, 'monthly', now), Date.UTC(2026, 11, 9));
  assert.equal(newExpiry(undefined, 'monthly', now), Date.UTC(2026, 11, 9));
});
