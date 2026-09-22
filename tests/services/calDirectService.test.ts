import { describe, it, expect, vi } from 'vitest';
import {
  normalizeTransaction,
  computeFetchPlan,
  type CalTransaction,
} from '../../src/services/calDirectService';

vi.mock('../../src/lib/supabase', () => ({ supabase: {} }));

// Shapes mirror live Cal API responses (Sept 2026), merchant names anonymized.
// A 3-payment purchase of ₪7,412 on 17/07: Cal puts the leftover agora on the first payment.
const completedInstallment = (curPaymentNum: number, amtBeforeConvAndIndex: number, debCrdDate: string): CalTransaction => ({
  merchantName: 'Furniture store',
  trnPurchaseDate: '2026-07-17T11:44:00',
  debCrdDate,
  trnAmt: 7412,
  amtBeforeConvAndIndex,
  trnCurrencySymbol: '₪',
  debCrdCurrencySymbol: '₪',
  trnTypeCode: '8',
  trnType: 'תשלומים',
  numOfPayments: 3,
  curPaymentNum,
  transTypeCommentDetails: '',
});

const normalize = (tx: CalTransaction, isPending = false) => normalizeTransaction(tx, 'card-1', isPending, '2532');

describe('normalizeTransaction — installments', () => {
  it('records the actual charge, not the full purchase amount', async () => {
    const tx = await normalize(completedInstallment(2, 2470.67, '2026-09-02'));
    expect(tx.amount).toBe(2470.67);
    expect(tx.installment_number).toBe(2);
    expect(tx.installment_total).toBe(3);
    expect(tx.processed_date).toBe('2026-09-02');
    expect(tx.original_amount).toBeNull(); // ILS purchase, nothing to convert
  });

  it('dates payment n at purchase date + (n − 1) months', async () => {
    const dates = await Promise.all([
      normalize(completedInstallment(1, 2470.66, '2026-08-02')),
      normalize(completedInstallment(2, 2470.67, '2026-09-02')),
      normalize(completedInstallment(3, 2470.67, '2026-10-02')),
    ]);
    expect(dates.map(t => t.date)).toEqual(['2026-07-17', '2026-08-17', '2026-09-17']);
  });

  it('clamps the day when the target month is shorter', async () => {
    const tx = await normalize({ ...completedInstallment(2, 100, '2026-03-02'), trnPurchaseDate: '2026-01-31T10:00:00' });
    expect(tx.date).toBe('2026-02-28');
  });

  it('gives each charge in a series its own dedupe hash', async () => {
    const [first, second, third] = await Promise.all([
      normalize(completedInstallment(1, 2470.66, '2026-08-02')),
      normalize(completedInstallment(2, 2470.67, '2026-09-02')),
      normalize(completedInstallment(3, 2470.67, '2026-10-02')),
    ]);
    expect(new Set([first.dedupe_hash, second.dedupe_hash, third.dedupe_hash]).size).toBe(3);
  });

  it('treats a pending installment as payment 1 with its first-payment amount, matching the later completed charge', async () => {
    const pending = await normalize({
      merchantName: 'Electronics store',
      trnPurchaseDate: '2026-08-18T21:25:00',
      trnAmt: 5384,
      firstPaymentAmount: 1796,
      currencyCode: 'ILS',
      numberOfPayments: 3,
      trnTypeCode: '8',
    }, true);
    const completed = await normalize({
      merchantName: 'Electronics store',
      trnPurchaseDate: '2026-08-18T21:25:00',
      debCrdDate: '2026-09-02',
      trnAmt: 5384,
      amtBeforeConvAndIndex: 1796,
      trnCurrencySymbol: '₪',
      numOfPayments: 3,
      curPaymentNum: 1,
      trnTypeCode: '8',
    });
    expect(pending).toMatchObject({ amount: 1796, installment_number: 1, installment_total: 3, date: '2026-08-18', status: 'pending' });
    expect(pending.dedupe_hash).toBe(completed.dedupe_hash);
  });
});

describe('normalizeTransaction — regular purchases', () => {
  it('stores no installment info when Cal reports 0 payments', async () => {
    const tx = await normalize({
      merchantName: 'Supermarket',
      trnPurchaseDate: '2026-09-20T10:00:00',
      debCrdDate: '2026-10-02',
      trnAmt: 110.4,
      amtBeforeConvAndIndex: 110.4,
      trnCurrencySymbol: '₪',
      numOfPayments: 0,
      trnTypeCode: '5',
    });
    expect(tx).toMatchObject({ amount: 110.4, date: '2026-09-20', installment_number: null, installment_total: null });
  });

  it('keeps the legacy dedupe hash so previously imported rows are still skipped', async () => {
    const tx = await normalize({
      merchantName: 'Supermarket',
      trnPurchaseDate: '2026-09-20T10:00:00',
      trnAmt: 110.4,
      amtBeforeConvAndIndex: 110.4,
      numOfPayments: 0,
    });
    const legacyInput = new TextEncoder().encode('2026-09-20|110.4|Supermarket');
    const digest = await crypto.subtle.digest('SHA-256', legacyInput);
    const legacyHash = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
    expect(tx.dedupe_hash).toBe(legacyHash);
  });

  it('stores the ILS charge for a completed foreign purchase, with the foreign amount as original', async () => {
    const tx = await normalize({
      merchantName: 'Streaming service',
      trnPurchaseDate: '2026-08-22T08:00:00',
      debCrdDate: '2026-09-02',
      trnAmt: 5.99,
      amtBeforeConvAndIndex: 20.14,
      trnCurrencySymbol: '$',
      numOfPayments: 0,
    });
    expect(tx).toMatchObject({ amount: 20.14, original_amount: 5.99, original_currency: '$' });
  });

  it('keeps the foreign amount with a memo for a pending foreign purchase', async () => {
    const tx = await normalize({
      merchantName: 'Streaming service',
      trnPurchaseDate: '2026-09-22T08:00:00',
      trnAmt: 5.99,
      trnCurrencySymbol: '$',
      numberOfPayments: 0,
    }, true);
    expect(tx.amount).toBe(5.99);
    expect(tx.memo).toContain('not yet settled');
  });
});

describe('computeFetchPlan', () => {
  it('keeps charges dated later in the current month', () => {
    const plan = computeFetchPlan({ type: 'current_month' }, new Date(2026, 8, 22));
    expect(plan.startDate).toBe('2026-09-01');
    expect(plan.endDate).toBe('2026-09-30');
    expect(plan.monthYears).toEqual([
      { month: 8, year: 2026 },
      { month: 9, year: 2026 },
      { month: 10, year: 2026 },
    ]);
  });

  it('runs a custom import through the end of the current month', () => {
    const plan = computeFetchPlan({ type: 'custom', startDate: '2026-04-01' }, new Date(2026, 8, 22));
    expect(plan.endDate).toBe('2026-09-30');
  });
});
