/**
 * Client-side Cal (Visa Cal) import service.
 *
 * Calls Cal APIs directly from the browser — no relay or Vercel function needed.
 * api.cal-online.co.il reflects any CORS Origin, and connect.cal-online.co.il
 * only blocks datacenter IPs (not residential/mobile browsers).
 *
 * Auth flow:
 * 1. PUT /otp (connect domain) → calSessionToken (triggers SMS)
 * 2. POST /otp (connect domain) → otpToken (verifies SMS code)
 * 3. otpToken used directly as "CALAuthScheme <token>" on api.cal-online.co.il
 * 4. POST account/init → cards[]
 * 5. POST getClearanceRequests → pending transactions
 * 6. POST getCardTransactionsDetails (month/year as strings!) → completed transactions
 */

import { supabase } from '../lib/supabase';
import { addMonthsToIsoDate } from '../utils/dateHelpers';
import { convertAmount, toCurrencyCode } from './exchangeRateService';
import { PersonalBudgetService } from './personalBudgetService';

// ─── Constants ───────────────────────────────────────────────────────────────

const OTP_URL = 'https://connect.cal-online.co.il/col-rest/calconnect/authentication/otp';
const ACCOUNT_INIT_URL = 'https://api.cal-online.co.il/Authentication/api/account/init';
const PENDING_URL = 'https://api.cal-online.co.il/Transactions/api/approvals/getClearanceRequests';
const TXN_URL = 'https://api.cal-online.co.il/Transactions/api/transactionsDetails/getCardTransactionsDetails';

const AUTH_SITE_ID = '5B5160DD-F84A-4D72-B67E-65891BA194FF';
const TXN_SITE_ID = '09031987-273E-2311-906C-8AF85B17C8D9';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CalCard {
  cardUniqueId: string;
  last4Digits: string;
}

// Field names verified against live Cal API responses (Sept 2026).
// Completed = getCardTransactionsDetails, pending = getClearanceRequests.
export interface CalTransaction {
  merchantName?: string;
  trnAmt?: number;                 // Full purchase amount, in trnCurrencySymbol / currencyCode
  amtBeforeConvAndIndex?: number;  // Completed only: the amount actually charged this cycle, in ILS
  firstPaymentAmount?: number;     // Pending only: first installment amount
  tpaApprovalAmount?: number;
  debCrdDate?: string;             // Completed only: billing date
  trnPurchaseDate?: string;        // Original purchase date (same for every installment in a series)
  trnCurrencySymbol?: string;
  debCrdCurrencySymbol?: string;
  currencyCode?: string;
  trnType?: string;
  trnTypeCode?: string | number;   // '8' = installments
  transTypeCommentDetails?: unknown;
  numOfPayments?: number;          // Completed only: number of installments (0 for regular purchases)
  curPaymentNum?: number;          // Completed only: which installment this charge is
  numberOfPayments?: number;       // Pending only: number of installments (0 for regular purchases)
  cardUniqueId?: string;
  [key: string]: unknown;
}

// Hebrew/English refund indicators used by Cal
const REFUND_PATTERNS = ['זיכוי', 'זיכוי חו"ל', 'החזר', 'credit', 'refund', 'CREDIT', 'REFUND'];
function isRefund(tx: CalTransaction): boolean {
  const type = String(tx.trnType ?? tx.transTypeCommentDetails ?? '').toLowerCase();
  return REFUND_PATTERNS.some(p => String(tx.trnType ?? '').includes(p) || type.includes(p.toLowerCase()));
}

// ILS currency symbols / codes that mean the amount is already in shekels
const ILS_SYMBOLS = new Set(['ils', '₪', 'nis', '376']);
function isIlsCurrency(symbol?: string): boolean {
  return !symbol || ILS_SYMBOLS.has(symbol.toLowerCase());
}

// ─── Period types ─────────────────────────────────────────────────────────────

export type ImportPeriod =
  | { type: 'current_month' }
  | { type: 'last_month' }
  | { type: 'custom'; startDate: string }; // YYYY-MM-DD, max 6 months back

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * For a given period, compute:
 *  - monthYears: which Cal billing-cycle months to request (always includes
 *    one month before and after the calendar range to handle cycle offsets)
 *  - startDate / endDate: ISO date strings to post-filter the results
 */
export function computeFetchPlan(
  period: ImportPeriod,
  now: Date
): { monthYears: { month: number; year: number }[]; startDate: string; endDate: string } {
  const addMonths = (base: Date, delta: number) =>
    new Date(base.getFullYear(), base.getMonth() + delta, 1);

  const toYM = (d: Date) => ({ month: d.getMonth() + 1, year: d.getFullYear() });

  const monthsInRange = (from: Date, to: Date) => {
    const result: { month: number; year: number }[] = [];
    let d = new Date(from.getFullYear(), from.getMonth(), 1);
    while (d <= to) { result.push(toYM(d)); d = addMonths(d, 1); }
    return result;
  };

  // Keep through the end of the current month: installment charges already scheduled
  // on the upcoming statement can be dated later this month
  const lastOfThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const endOfThisMonth = `${lastOfThisMonth.getFullYear()}-${pad2(lastOfThisMonth.getMonth() + 1)}-${pad2(lastOfThisMonth.getDate())}`;

  if (period.type === 'current_month') {
    const start = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-01`;
    // Fetch one month before, current month, and next month to cover billing-cycle offsets
    const months = monthsInRange(addMonths(now, -1), addMonths(now, 1));
    return { monthYears: months, startDate: start, endDate: endOfThisMonth };
  }

  if (period.type === 'last_month') {
    const lastMonth = addMonths(now, -1);
    const start = `${lastMonth.getFullYear()}-${pad2(lastMonth.getMonth() + 1)}-01`;
    const lastDay = new Date(now.getFullYear(), now.getMonth(), 0); // last day of prev month
    const end = lastDay.toISOString().slice(0, 10);
    const months = monthsInRange(addMonths(lastMonth, -1), addMonths(lastMonth, 1));
    return { monthYears: months, startDate: start, endDate: end };
  }

  // custom
  const start = new Date(period.startDate);
  const months = monthsInRange(addMonths(start, -1), addMonths(now, 1));
  return { monthYears: months, startDate: period.startDate, endDate: endOfThisMonth };
}

export interface NormalizedTx {
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  original_amount: number | null;
  original_currency: string | null;
  processed_date: string | null;
  installment_number: number | null;
  installment_total: number | null;
  memo: string | null;
  bank_card_last4: string | null;
  dedupe_hash: string;
  status: string;
  _cardUniqueId: string;
  _chargeCurrency: string | null; // ISO code `amount` is in (null if unknown); not stored
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const buffer = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function calApiHeaders(otpToken: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': `CALAuthScheme ${otpToken}`,
    'X-Site-Id': TXN_SITE_ID,
    'origin': 'https://digital-web.cal-online.co.il',
    'referer': 'https://digital-web.cal-online.co.il/',
  };
}

function calConnectHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-site-id': AUTH_SITE_ID,
    'origin': 'https://connect.cal-online.co.il',
    'referer': 'https://connect.cal-online.co.il/send-otp',
  };
}

// ─── OTP flow ─────────────────────────────────────────────────────────────────

/**
 * Step 1: Trigger SMS OTP.
 * Returns calSessionToken to pass back with the OTP code.
 */
export async function requestCalOtp(nationalId: string, last4Digits: string): Promise<string> {
  const res = await fetch(OTP_URL, {
    method: 'PUT',
    headers: calConnectHeaders(),
    body: JSON.stringify({
      userId: nationalId,
      last4Digits,
      bankAccountNum: last4Digits,
      sMSTemplate: null,
      recaptcha: '',
    }),
  });

  const body = await res.json().catch(() => ({})) as Record<string, unknown>;

  if (!res.ok) {
    const msg = (body.message ?? body.error ?? `HTTP ${res.status}`) as string;
    throw new Error(`OTP request failed: ${msg}`);
  }

  const calSessionToken = (body.token ?? (body.result as Record<string, unknown>)?.token ?? body.sessionToken) as string | undefined;
  if (!calSessionToken) {
    throw new Error(`OTP request response missing session token. Keys: ${Object.keys(body).join(', ')}`);
  }

  return calSessionToken;
}

/**
 * Step 2: Verify the OTP code.
 * Returns otpToken — used directly as the Authorization header on api.cal-online.co.il.
 */
export async function verifyCalOtp(nationalId: string, calSessionToken: string, otpCode: string): Promise<string> {
  const res = await fetch(OTP_URL, {
    method: 'POST',
    headers: calConnectHeaders(),
    body: JSON.stringify({ custID: nationalId, password: otpCode, token: calSessionToken }),
  });

  const body = await res.json().catch(() => ({})) as Record<string, unknown>;

  if (!res.ok) {
    const msg = (body.message ?? body.error ?? body.description ?? `HTTP ${res.status}`) as string;
    throw new Error(`OTP verification failed: ${msg}`);
  }

  const otpToken = body.token as string | undefined;
  if (!otpToken) {
    throw new Error(`OTP verify response missing 'token'. Keys: ${Object.keys(body).join(', ')}`);
  }

  return otpToken;
}

// ─── Cards ───────────────────────────────────────────────────────────────────

async function getCards(otpToken: string): Promise<CalCard[]> {
  const res = await fetch(ACCOUNT_INIT_URL, {
    method: 'POST',
    headers: calApiHeaders(otpToken),
    body: JSON.stringify({ tokenGuid: '' }),
  });

  const body = await res.json().catch(() => ({})) as Record<string, unknown>;
  const result = body.result as Record<string, unknown> | undefined;

  const cards = (result?.cards as CalCard[] | undefined) ?? [];
  console.log(`[cal-direct] account/init → ${cards.length} cards, resultKeys=${Object.keys(result ?? {}).join(',')}`);
  if (cards.length > 0) {
    console.log(`[cal-direct] first card keys: ${Object.keys(cards[0]).join(',')}`);
  }
  return cards;
}

// ─── Transactions ─────────────────────────────────────────────────────────────

async function fetchPendingTransactions(otpToken: string, cardUniqueId: string): Promise<CalTransaction[]> {
  const res = await fetch(PENDING_URL, {
    method: 'POST',
    headers: calApiHeaders(otpToken),
    body: JSON.stringify({ cardUniqueIDArray: [cardUniqueId] }),
  });

  const body = await res.json().catch(() => ({})) as Record<string, unknown>;
  const result = body.result as Record<string, unknown> | undefined;
  const cardsList = (result?.cardsList as Array<Record<string, unknown>>) ?? [];

  const txns: CalTransaction[] = [];
  for (const card of cardsList) {
    const list = card.authDetalisList as CalTransaction[] | undefined;
    if (list) txns.push(...list);
  }
  return txns;
}

async function fetchCompletedTransactions(
  otpToken: string,
  cardUniqueId: string,
  month: number,
  year: number
): Promise<CalTransaction[]> {
  // Try both padded and unpadded month — some Cal endpoint versions require zero-padding
  const monthStr = String(month).padStart(2, '0');
  const monthStrAlt = String(month);

  for (const mStr of [monthStr, monthStrAlt]) {
    const body_req = JSON.stringify({ cardUniqueId, month: mStr, year: String(year) });
    const res = await fetch(TXN_URL, {
      method: 'POST',
      headers: calApiHeaders(otpToken),
      body: body_req,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn(
        `[cal-direct] fetchCompleted HTTP ${res.status} card=${cardUniqueId.slice(-4)} ${mStr}/${year}` +
        ` body=${errText.slice(0, 300)}`
      );
      if (mStr === monthStr && monthStr !== monthStrAlt) continue; // retry with unpadded
      return [];
    }

    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    const result = body.result as Record<string, unknown> | undefined;

    const txns: CalTransaction[] = [];
    const bankAccounts = (result?.bankAccounts as Array<Record<string, unknown>>) ?? [];
    for (const acct of bankAccounts) {
      const immediateDebits = acct.immidiateDebits as Record<string, unknown> | undefined;
      const debitDays = [
        ...((acct.debitDates as Array<Record<string, unknown>>) ?? []),
        ...((immediateDebits?.debitDays as Array<Record<string, unknown>>) ?? []),
      ];
      for (const dd of debitDays) {
        if (dd.txnIsrael) txns.push(...(dd.txnIsrael as CalTransaction[]));
        if (dd.txnAbroad) txns.push(...(dd.txnAbroad as CalTransaction[]));
        if (dd.transactions) txns.push(...(dd.transactions as CalTransaction[]));
      }
    }
    if (result?.cardTransactionList) {
      for (const item of (result.cardTransactionList as Array<Record<string, unknown>>)) {
        if (item.txnIsrael) txns.push(...(item.txnIsrael as CalTransaction[]));
        if (item.txnAbroad) txns.push(...(item.txnAbroad as CalTransaction[]));
      }
    }
    console.log(`[cal-direct] fetchCompleted ${mStr}/${year} card=${cardUniqueId.slice(-4)} → ${txns.length} txns` +
      ` resultKeys=${Object.keys(result ?? {}).join(',')}`);
    return txns;
  }
  return [];
}

// ─── Normalization ────────────────────────────────────────────────────────────

export async function normalizeTransaction(
  tx: CalTransaction,
  cardUniqueId: string,
  isPending: boolean,
  cardLast4: string | null
): Promise<NormalizedTx> {
  const purchaseDate = (tx.trnPurchaseDate ?? tx.debCrdDate ?? new Date().toISOString()).slice(0, 10);
  const billingDate = tx.debCrdDate;
  const description = tx.merchantName ?? 'Unknown';

  // Installments: pending rows are always the first payment. Regular purchases report 0 payments.
  const paymentsTotal = Number(isPending ? tx.numberOfPayments : tx.numOfPayments) || 0;
  const isInstallment = paymentsTotal > 1;
  const paymentNumber = isInstallment ? (isPending ? 1 : Number(tx.curPaymentNum) || 1) : null;

  // Every charge in a series carries the original purchase date. Date payment n at
  // purchase date + (n − 1) months so each charge lands in its own month.
  const date = paymentNumber ? addMonthsToIsoDate(purchaseDate, paymentNumber - 1) : purchaseDate;

  // Currency resolution:
  // trnAmt is the full purchase amount in the transaction currency (the whole series for installments).
  // amtBeforeConvAndIndex (completed) / firstPaymentAmount (pending installments) is what's charged now, in ILS.
  const txCurrency = tx.trnCurrencySymbol ?? tx.currencyCode;
  const purchaseAmount = tx.trnAmt;
  const chargedInIls: number | undefined =
    !isPending ? tx.amtBeforeConvAndIndex
    : isInstallment ? tx.firstPaymentAmount
    : isIlsCurrency(txCurrency) ? purchaseAmount
    : undefined;

  let amount: number;
  let chargeCurrency: string | null = 'ILS';
  let originalAmount: number | null = null;
  let originalCurrency: string | null = null;
  let fxMemo: string | null = null;

  if (chargedInIls != null) {
    amount = Math.abs(chargedInIls);
    if (!isPending) chargeCurrency = toCurrencyCode(tx.debCrdCurrencySymbol) ?? 'ILS';
    if (purchaseAmount != null && !isIlsCurrency(txCurrency)) {
      originalAmount = Math.abs(purchaseAmount);
      originalCurrency = txCurrency ?? null;
    }
  } else if (purchaseAmount != null && !isIlsCurrency(txCurrency)) {
    // Pending foreign transaction: only the foreign amount is known until it's billed.
    // convertToBudgetCurrency() replaces it with an estimate at that day's exchange rate.
    amount = Math.abs(purchaseAmount);
    chargeCurrency = toCurrencyCode(txCurrency);
    originalAmount = Math.abs(purchaseAmount);
    originalCurrency = txCurrency ?? null;
    fxMemo = `${FX_UNSETTLED_MEMO} (${txCurrency ?? 'unknown'}) — ILS amount not yet settled`;
  } else {
    amount = Math.abs(purchaseAmount ?? 0);
  }

  // Refund / credit detection: check trnType for Hebrew/English credit indicators,
  // then fall back to sign of the raw charged amount
  const rawSign = chargedInIls ?? purchaseAmount ?? 0;
  const refund = isRefund(tx) || rawSign < 0;
  const type: 'income' | 'expense' = refund ? 'income' : 'expense';

  const memoFromTx = tx.transTypeCommentDetails ? String(tx.transTypeCommentDetails) : null;
  const memo = [fxMemo, memoFromTx].filter(Boolean).join(' | ') || null;

  // Regular purchases keep the original hash inputs (purchase date | |trnAmt| | merchant) so rows
  // imported before this change are still recognised as duplicates. Installment charges add n/N,
  // otherwise every charge in a series would collide with the first one.
  const dedupe_hash = isInstallment
    ? await sha256Hex(`${date}|${amount}|${description}|${paymentNumber}/${paymentsTotal}`)
    : await sha256Hex(`${purchaseDate}|${Math.abs(purchaseAmount ?? 0)}|${description}`);

  return {
    date,
    description,
    amount,
    type,
    category: 'Uncategorized',
    original_amount: originalAmount,
    original_currency: originalCurrency,
    processed_date: isPending ? null : (billingDate?.slice(0, 10) ?? null),
    installment_number: paymentNumber,
    installment_total: isInstallment ? paymentsTotal : null,
    memo,
    bank_card_last4: cardLast4,
    dedupe_hash,
    status: isPending ? 'pending' : 'completed',
    _cardUniqueId: cardUniqueId,
    _chargeCurrency: chargeCurrency,
  };
}

// ─── Currency conversion ─────────────────────────────────────────────────────

const FX_UNSETTLED_MEMO = 'Foreign currency';
export const FX_CONVERTED_MEMO = '≈ Converted';

const withoutFxMemo = (memo: string | null) =>
  (memo ?? '').split(' | ').filter(part => part && !part.startsWith(FX_UNSETTLED_MEMO) && !part.startsWith(FX_CONVERTED_MEMO));

/**
 * Convert amounts that aren't in the budget currency, at the exchange rate for the transaction date.
 * These are estimates: the billed charge replaces them on a later import (see planImport).
 * Transactions whose currency is unknown or whose rate can't be fetched are left as they are.
 */
export async function convertToBudgetCurrency(txns: NormalizedTx[], budgetCurrency: string): Promise<number> {
  let converted = 0;
  await Promise.all(txns.map(async tx => {
    const from = tx._chargeCurrency;
    if (!from || from === budgetCurrency) return;
    try {
      const result = await convertAmount(tx.amount, from, budgetCurrency, tx.date);
      if (tx.original_amount == null) {
        tx.original_amount = tx.amount;
        tx.original_currency = from;
      }
      tx.memo = [
        `${FX_CONVERTED_MEMO} from ${tx.amount} ${from} at ${result.rate} (${result.source}, ${result.rateDate})`,
        ...withoutFxMemo(tx.memo),
      ].join(' | ');
      tx.amount = result.amount;
      tx._chargeCurrency = budgetCurrency;
      converted++;
    } catch (err) {
      console.warn(`[cal-direct] No ${from}→${budgetCurrency} rate for ${tx.date}; keeping the original amount`, err);
    }
  }));
  return converted;
}

// ─── Supabase push ────────────────────────────────────────────────────────────

export interface ExistingImportRow {
  id: string;
  dedupe_hash: string;
  status: string | null;
  amount: number | string;
  original_amount: number | string | null;
  original_currency: string | null;
}

/** A stored foreign-currency row whose amount was never converted (amount still equals the foreign amount) */
function isUnconvertedForeign(row: Pick<ExistingImportRow, 'amount' | 'original_amount' | 'original_currency'>, budgetCurrency: string) {
  const currency = toCurrencyCode(row.original_currency);
  return !!currency && currency !== budgetCurrency &&
    row.original_amount != null && Number(row.amount) === Number(row.original_amount);
}

/**
 * Split incoming rows into new ones and better versions of rows already stored.
 * An existing row is replaced when the incoming one is the billed version of a pending row, or
 * carries the real budget-currency charge for a row still stored in a foreign amount.
 */
export function planImport(
  incoming: NormalizedTx[],
  existing: ExistingImportRow[],
  budgetCurrency: string
): { toInsert: NormalizedTx[]; toUpdate: { id: string; tx: NormalizedTx }[]; skipped: number } {
  const existingByHash = new Map(existing.map(row => [row.dedupe_hash, row]));
  const seenInBatch = new Set<string>();
  const toInsert: NormalizedTx[] = [];
  const toUpdate: { id: string; tx: NormalizedTx }[] = [];

  for (const tx of incoming) {
    if (seenInBatch.has(tx.dedupe_hash)) continue;
    seenInBatch.add(tx.dedupe_hash);

    const row = existingByHash.get(tx.dedupe_hash);
    if (!row) {
      toInsert.push(tx);
      continue;
    }
    const billedVersionOfPending = row.status === 'pending' && tx.status === 'completed';
    const realChargeForUnconverted = isUnconvertedForeign(row, budgetCurrency) &&
      tx._chargeCurrency === budgetCurrency && tx.amount !== Number(row.amount);
    if (billedVersionOfPending || realChargeForUnconverted) toUpdate.push({ id: row.id, tx });
  }

  return { toInsert, toUpdate, skipped: incoming.length - toInsert.length - toUpdate.length };
}

async function pushToSupabase(
  txns: NormalizedTx[],
  userId: string,
  householdId: string,
  connectionId: string,
  dbSessionId: string | null,
  budgetCurrency: string
): Promise<{ imported: number; updated: number; skipped: number }> {
  // Check which hashes already exist in DB
  const hashes = [...new Set(txns.map(t => t.dedupe_hash))];
  const { data: existing } = await supabase
    .from('transactions')
    .select('id, dedupe_hash, status, amount, original_amount, original_currency')
    .eq('household_id', householdId)
    .in('dedupe_hash', hashes);

  const { toInsert, toUpdate, skipped } = planImport(txns, (existing ?? []) as ExistingImportRow[], budgetCurrency);

  // Replace pending / unconverted rows with the billed amounts; keep the user's category and description
  for (const { id, tx } of toUpdate) {
    const { error } = await supabase
      .from('transactions')
      .update({
        amount: tx.amount,
        original_amount: tx.original_amount,
        original_currency: tx.original_currency,
        processed_date: tx.processed_date,
        status: tx.status,
        memo: tx.memo,
      })
      .eq('id', id);
    if (error) throw new Error(`Supabase update failed: ${error.message}`);
  }

  if (toInsert.length > 0) {
    // Drop internal `_` fields (card id, charge currency) that aren't columns
    const rows = toInsert.map(tx => ({
      ...Object.fromEntries(Object.entries(tx).filter(([key]) => !key.startsWith('_'))),
      user_id: userId,
      household_id: householdId,
      bank_connection_id: connectionId,
      import_session_id: dbSessionId,
    }));

    const { error } = await supabase.from('transactions').insert(rows);
    if (error) throw new Error(`Supabase insert failed: ${error.message}`);
  }

  return { imported: toInsert.length, updated: toUpdate.length, skipped };
}

/**
 * Convert stored bank rows still held in a foreign amount (imported before conversion existed,
 * or outside the latest import window) at the exchange rate for their date.
 */
async function convertStoredForeignRows(householdId: string, budgetCurrency: string): Promise<number> {
  const { data } = await supabase
    .from('transactions')
    .select('id, date, amount, original_amount, original_currency, memo')
    .eq('household_id', householdId)
    .eq('source', 'bank_import')
    .not('original_currency', 'is', null);

  type StoredRow = { id: string; date: string; amount: number | string; original_amount: number | string | null; original_currency: string | null; memo: string | null };
  const unconverted = ((data ?? []) as StoredRow[]).filter(row =>
    isUnconvertedForeign(row, budgetCurrency) && !row.memo?.includes(FX_CONVERTED_MEMO));

  let converted = 0;
  for (const row of unconverted) {
    const from = toCurrencyCode(row.original_currency)!;
    const original = Number(row.original_amount);
    try {
      const result = await convertAmount(original, from, budgetCurrency, row.date);
      const memo = [
        `${FX_CONVERTED_MEMO} from ${original} ${from} at ${result.rate} (${result.source}, ${result.rateDate})`,
        ...withoutFxMemo(row.memo),
      ].join(' | ');
      const { error } = await supabase.from('transactions').update({ amount: result.amount, memo }).eq('id', row.id);
      if (!error) converted++;
    } catch (err) {
      console.warn(`[cal-direct] Could not convert stored row ${row.id} (${from})`, err);
    }
  }
  return converted;
}

// ─── Main import ──────────────────────────────────────────────────────────────

/**
 * Full import: fetch cards → pending + completed transactions → dedup → push to Supabase.
 * The caller must have already verified the OTP and obtained otpToken.
 */
export async function importCalTransactions(
  connectionId: string,
  otpToken: string,
  period: ImportPeriod,
  onProgress?: (msg: string) => void
): Promise<{ dbSessionId: string; imported: number; updated: number; skipped: number }> {
  const log = (msg: string) => {
    console.log(`[cal-direct] ${msg}`);
    onProgress?.(msg);
  };

  // Get user + household
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: hh } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .limit(1)
    .single();
  if (!hh) throw new Error('No household found for user');
  const householdId = hh.household_id as string;

  // Discover cards
  log('Fetching cards…');
  const cards = await getCards(otpToken);
  if (cards.length === 0) throw new Error('No cards found on account');
  log(`Found ${cards.length} card(s): ${cards.map(c => c.last4Digits).join(', ')}`);

  // Compute which billing-cycle months to request and the date range to keep
  const now = new Date();
  const { monthYears, startDate, endDate } = computeFetchPlan(period, now);
  log(`Fetching billing cycles: ${monthYears.map(m => `${m.month}/${m.year}`).join(', ')} | filter: ${startDate} → ${endDate}`);

  // Fetch transactions
  const allRawTxns: NormalizedTx[] = [];
  await Promise.all(
    cards.map(async card => {
      const pending = await fetchPendingTransactions(otpToken, card.cardUniqueId);
      for (const tx of pending) {
        allRawTxns.push(await normalizeTransaction(tx, card.cardUniqueId, true, card.last4Digits));
      }
      for (const { month, year } of monthYears) {
        const completed = await fetchCompletedTransactions(otpToken, card.cardUniqueId, month, year);
        for (const tx of completed) {
          allRawTxns.push(await normalizeTransaction(tx, card.cardUniqueId, false, card.last4Digits));
        }
      }
    })
  );
  log(`Fetched ${allRawTxns.length} raw transactions`);

  // Post-filter to the requested calendar date range
  const filtered = allRawTxns.filter(tx => tx.date >= startDate && tx.date <= endDate);
  if (filtered.length < allRawTxns.length) {
    log(`Kept ${filtered.length} transactions in range (dropped ${allRawTxns.length - filtered.length} outside ${startDate}–${endDate})`);
  }

  // Create import session — requires INSERT policy (migration 031).
  // Falls back to null (nullable FK) if the insert fails for any reason.
  let dbSessionId: string | null = null;
  const { data: sessionRow } = await supabase
    .from('bank_import_sessions')
    .insert({ user_id: user.id, household_id: householdId, status: 'complete', completed_at: new Date().toISOString() })
    .select('id')
    .single();
  dbSessionId = (sessionRow as { id: string } | null)?.id ?? null;

  // Convert foreign amounts into the budget currency (estimates until billed)
  const activeBudget = await PersonalBudgetService.getActiveBudget().catch(() => null);
  const budgetCurrency = toCurrencyCode(activeBudget?.global_settings?.currency) ?? 'ILS';
  const convertedCount = await convertToBudgetCurrency(filtered, budgetCurrency);
  if (convertedCount > 0) log(`Converted ${convertedCount} foreign-currency amount(s) to ${budgetCurrency}`);

  // Push to Supabase
  const { imported, updated, skipped } = await pushToSupabase(
    filtered, user.id, householdId, connectionId, dbSessionId, budgetCurrency
  );

  // Older rows still stored in a foreign amount (e.g. outside this import's window)
  const storedConverted = await convertStoredForeignRows(householdId, budgetCurrency);
  if (storedConverted > 0) log(`Converted ${storedConverted} stored foreign-currency row(s) to ${budgetCurrency}`);

  // Update last_sync_at
  await supabase
    .from('bank_connections')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('id', connectionId);

  log(`Done: ${imported} imported, ${updated} updated with billed amounts, ${skipped} skipped`);
  return { dbSessionId, imported, updated, skipped };
}
