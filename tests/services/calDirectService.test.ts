import { describe, it, expect, vi } from 'vitest';
import {
  normalizeTransaction,
  computeFetchPlan,
  convertToBudgetCurrency,
  planImport,
  type CalTransaction,
  type NormalizedTx,
  type ExistingImportRow,
} from '../../src/services/calDirectService';

vi.mock('../../src/lib/supabase', () => ({ supabase: {} }));
vi.mock('../../src/services/exchangeRateService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/services/exchangeRateService')>()),
  // USD→ILS at 3.0 on any date; everything else has no rate
  convertAmount: vi.fn(async (amount: number, from: string, to: string, date: string) => {
    if (from !== 'USD' || to !== 'ILS') throw new Error('no rate');
    return { amount: Math.round(amount * 3 * 100) / 100, rate: 3, rateDate: date, source: 'ECB' };
  }),
}));

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
    // Pending rows have no Cal id yet, so they're paired with the billed charge by link key
    expect(pending._linkKey).toBe(completed._linkKey);
    expect(pending._legacyHash).toBe(completed._legacyHash);
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

  it('still computes the legacy key so rows stored before the new keys are recognised', async () => {
    const tx = await normalize({
      merchantName: 'Supermarket',
      trnPurchaseDate: '2026-09-20T10:00:00',
      trnAmt: 110.4,
      amtBeforeConvAndIndex: 110.4,
      numOfPayments: 0,
      trnIntId: 'A1',
    });
    const legacyInput = new TextEncoder().encode('2026-09-20|110.4|Supermarket');
    const digest = await crypto.subtle.digest('SHA-256', legacyInput);
    const legacyHash = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
    expect(tx._legacyHash).toBe(legacyHash);
    expect(tx.dedupe_hash).not.toBe(legacyHash);
  });

  it('keeps two identical same-day purchases apart by Cal\'s transaction id', async () => {
    const coffee = { merchantName: 'Cafe', trnPurchaseDate: '2026-09-20T09:00:00', debCrdDate: '2026-10-02', trnAmt: 18, amtBeforeConvAndIndex: 18, numOfPayments: 0 };
    const first = await normalize({ ...coffee, trnIntId: 'T1' });
    const second = await normalize({ ...coffee, trnIntId: 'T2' });
    expect(first.dedupe_hash).not.toBe(second.dedupe_hash);
  });

  it('keeps a same-day refund of the same amount apart from the purchase', async () => {
    const base = { merchantName: 'Shop', trnPurchaseDate: '2026-09-20T09:00:00', trnAmt: 120, currencyCode: 'ILS', numberOfPayments: 0 };
    const purchase = await normalize(base, true);
    const refund = await normalize({ ...base, trnType: 'זיכוי' }, true);
    expect(refund.type).toBe('income');
    expect(refund.dedupe_hash).not.toBe(purchase.dedupe_hash);
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

const pendingForeign: CalTransaction = {
  merchantName: 'Streaming service',
  trnPurchaseDate: '2026-09-22T08:00:00',
  trnAmt: 5.99,
  trnCurrencySymbol: '$',
  numberOfPayments: 0,
};
const completedForeign: CalTransaction = {
  ...pendingForeign,
  debCrdDate: '2026-10-02',
  amtBeforeConvAndIndex: 18.14,
  debCrdCurrencySymbol: '₪',
  numOfPayments: 0,
};

describe('convertToBudgetCurrency', () => {
  it('converts a pending foreign amount at that day\'s rate and records the original', async () => {
    const tx = await normalize(pendingForeign, true);
    expect(await convertToBudgetCurrency([tx], 'ILS')).toBe(1);
    expect(tx).toMatchObject({ amount: 17.97, original_amount: 5.99, original_currency: '$', _chargeCurrency: 'ILS' });
    expect(tx.memo).toContain('≈ Converted from 5.99 USD at 3');
    expect(tx.memo).not.toContain('not yet settled');
  });

  it('leaves amounts already in the budget currency alone', async () => {
    const tx = await normalize(completedForeign);
    expect(await convertToBudgetCurrency([tx], 'ILS')).toBe(0);
    expect(tx.amount).toBe(18.14);
  });

  it('keeps the original amount when no rate is available', async () => {
    const tx = await normalize({ ...pendingForeign, trnCurrencySymbol: '€' }, true);
    expect(await convertToBudgetCurrency([tx], 'ILS')).toBe(0);
    expect(tx.amount).toBe(5.99);
    expect(tx.memo).toContain('not yet settled');
  });
});

describe('planImport', () => {
  const existingRow = (tx: NormalizedTx, overrides: Partial<ExistingImportRow> = {}): ExistingImportRow => ({
    id: 'row-1', dedupe_hash: tx.dedupe_hash, status: tx.status, amount: tx.amount,
    original_amount: tx.original_amount, original_currency: tx.original_currency,
    date: tx.date, description: tx.description, type: tx.type, bank_card_last4: tx.bank_card_last4,
    installment_number: tx.installment_number, installment_total: tx.installment_total, ...overrides,
  });
  const billedForeign = () => normalize({ ...completedForeign, trnIntId: 'F1' });

  it('inserts new rows and reports rows already stored as duplicates, ignoring repeats within the batch', async () => {
    const a = await billedForeign();
    const b = await normalize({ ...completedForeign, merchantName: 'Bookshop', trnIntId: 'B1' });
    const plan = planImport([a, b, { ...b }], [existingRow(a)], 'ILS');
    expect(plan.toInsert).toEqual([b]);
    expect(plan.toUpdate).toEqual([]);
    expect(plan.duplicates).toEqual([a]); // the repeated `b` isn't a duplicate of anything stored
  });

  it('recognises a row stored under the legacy key', async () => {
    const billed = await billedForeign();
    const stored = existingRow(billed, { dedupe_hash: billed._legacyHash });
    const plan = planImport([billed], [stored], 'ILS');
    expect(plan.toInsert).toEqual([]);
    expect(plan.duplicates).toEqual([billed]);
  });

  it('pairs a stored pending row with its billed version, even when the amount changed', async () => {
    const pending = await normalize(pendingForeign, true);
    await convertToBudgetCurrency([pending], 'ILS');
    const billed = await billedForeign();
    expect(billed.dedupe_hash).not.toBe(pending.dedupe_hash);

    const plan = planImport([billed], [], 'ILS', { pendingRows: [existingRow(pending)] });
    expect(plan.toUpdate).toEqual([{ id: 'row-1', tx: billed }]); // update also moves it to the billed key
    expect(plan.toInsert).toEqual([]);
  });

  it('keeps only the billed version when a charge is both pending and billed in one fetch', async () => {
    const pending = await normalize(pendingForeign, true);
    const billed = await billedForeign();
    const plan = planImport([pending, billed], [], 'ILS');
    expect(plan.toInsert).toEqual([billed]);
  });

  it('updates a pending row whose amount changed while still pending', async () => {
    const earlier = await normalize({ ...pendingForeign, trnCurrencySymbol: '₪', trnAmt: 100 }, true);
    const later = await normalize({ ...pendingForeign, trnCurrencySymbol: '₪', trnAmt: 100 }, true);
    later.amount = 112.5; // e.g. a fuel pre-authorisation settling
    const plan = planImport([later], [], 'ILS', { pendingRows: [existingRow(earlier)] });
    expect(plan.toUpdate).toEqual([{ id: 'row-1', tx: later }]);
  });

  it('does not bring back rows a member deleted', async () => {
    const billed = await billedForeign();
    const legacyOnly = await normalize({ ...completedForeign, merchantName: 'Old', trnIntId: 'O1' });
    const plan = planImport([billed, legacyOnly], [], 'ILS', {
      tombstoneKeys: new Set([billed.dedupe_hash, legacyOnly._legacyHash]),
    });
    expect(plan.deleted).toEqual([billed, legacyOnly]);
    expect(plan.toInsert).toEqual([]);
  });

  it('replaces a stored row that still holds the foreign amount with the real charge', async () => {
    const billed = await billedForeign();
    // Imported by the old code: status completed, amount = the dollar amount
    const legacy = existingRow(billed, { status: 'completed', amount: '5.99', original_amount: '5.99', original_currency: '$' });
    expect(planImport([billed], [legacy], 'ILS').toUpdate).toEqual([{ id: 'row-1', tx: billed }]);
  });

  it('does not touch a row already stored with the right amount', async () => {
    const billed = await billedForeign();
    const plan = planImport([billed], [existingRow(billed)], 'ILS');
    expect(plan.toUpdate).toEqual([]);
    expect(plan.duplicates).toEqual([billed]);
  });
});
