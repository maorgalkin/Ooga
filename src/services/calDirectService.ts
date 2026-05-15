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

interface CalTransaction {
  merchantName?: string;
  transactionAmount?: number;
  chargedAmount?: number;
  authAmount?: number;
  activityAmount?: number;
  trnAmt?: number;
  tpaApprovalAmount?: number;
  debCrdDate?: string;
  transDate?: string;
  purchaseDate?: string;
  activityDate?: string;
  trnPurchaseDate?: string;
  trnCurrencySymbol?: string;
  debCrdCurrencySymbol?: string;
  currencyCode?: string;
  transTypeCommentDetails?: unknown;
  installmentsNumber?: number;
  numberOfPayments?: number;
  currentPaymentNum?: number;
  firstPaymentAmount?: number;
  cardUniqueId?: string;
  [key: string]: unknown;
}

interface NormalizedTx {
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
  console.log(`[cal-direct] account/init → ${cards.length} cards`);
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
  const res = await fetch(TXN_URL, {
    method: 'POST',
    headers: calApiHeaders(otpToken),
    // month and year MUST be strings — numbers cause HTTP 400
    body: JSON.stringify({ cardUniqueId, month: String(month), year: String(year) }),
  });

  if (!res.ok) {
    console.warn(`[cal-direct] fetchCompleted HTTP ${res.status} for card=${cardUniqueId.slice(-4)} ${month}/${year}`);
    return [];
  }

  const body = await res.json().catch(() => ({})) as Record<string, unknown>;
  const result = body.result as Record<string, unknown> | undefined;

  const txns: CalTransaction[] = [];
  const bankAccounts = (result?.bankAccounts as Array<Record<string, unknown>>) ?? [];
  for (const acct of bankAccounts) {
    for (const dd of (acct.debitDates as Array<Record<string, unknown>>) ?? []) {
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
  console.log(`[cal-direct] fetchCompleted ${month}/${year} card=${cardUniqueId.slice(-4)} → ${txns.length} txns`);
  return txns;
}

// ─── Normalization ────────────────────────────────────────────────────────────

async function normalizeTransaction(
  tx: CalTransaction,
  cardUniqueId: string,
  isPending: boolean,
  cardLast4: string | null
): Promise<NormalizedTx> {
  const chargedAmount =
    tx.chargedAmount ?? tx.transactionAmount ?? tx.trnAmt ?? tx.authAmount ?? tx.activityAmount ?? 0;
  const date =
    tx.debCrdDate ?? tx.trnPurchaseDate ?? tx.activityDate ?? tx.transDate ?? tx.purchaseDate ?? new Date().toISOString();
  const description = tx.merchantName ?? 'Unknown';
  const installments = tx.installmentsNumber ?? tx.numberOfPayments ?? null;

  const dedupe_hash = await sha256Hex(`${date.slice(0, 10)}|${chargedAmount}|${description}`);

  return {
    date: date.slice(0, 10),
    description,
    amount: Math.abs(chargedAmount),
    type: chargedAmount < 0 ? 'income' : 'expense',
    category: 'Uncategorized',
    original_amount:
      tx.transactionAmount != null && tx.transactionAmount !== chargedAmount ? tx.transactionAmount : null,
    original_currency: tx.trnCurrencySymbol ?? null,
    processed_date: isPending ? null : (tx.debCrdDate?.slice(0, 10) ?? null),
    installment_number: tx.currentPaymentNum ?? null,
    installment_total: installments,
    memo: tx.transTypeCommentDetails ? String(tx.transTypeCommentDetails) : null,
    bank_card_last4: cardLast4,
    dedupe_hash,
    status: isPending ? 'pending' : 'completed',
    _cardUniqueId: cardUniqueId,
  };
}

// ─── Supabase push ────────────────────────────────────────────────────────────

async function pushToSupabase(
  txns: NormalizedTx[],
  userId: string,
  householdId: string,
  connectionId: string,
  dbSessionId: string | null
): Promise<{ imported: number; skipped: number }> {
  // Dedup within batch
  const seenInBatch = new Set<string>();
  const dedupedTxns = txns.filter(t => {
    if (seenInBatch.has(t.dedupe_hash)) return false;
    seenInBatch.add(t.dedupe_hash);
    return true;
  });

  // Check which hashes already exist in DB
  const hashes = dedupedTxns.map(t => t.dedupe_hash);
  const { data: existing } = await supabase
    .from('transactions')
    .select('dedupe_hash')
    .eq('household_id', householdId)
    .in('dedupe_hash', hashes);

  const existingSet = new Set((existing ?? []).map((r: { dedupe_hash: string }) => r.dedupe_hash));
  const newTxns = dedupedTxns.filter(t => !existingSet.has(t.dedupe_hash));

  if (newTxns.length === 0) {
    return { imported: 0, skipped: txns.length };
  }

  const rows = newTxns.map(({ _cardUniqueId: _cid, ...tx }) => ({
    ...tx,
    user_id: userId,
    household_id: householdId,
    bank_connection_id: connectionId,
    import_session_id: dbSessionId,
  }));

  const { error } = await supabase.from('transactions').insert(rows);
  if (error) throw new Error(`Supabase insert failed: ${error.message}`);

  return { imported: newTxns.length, skipped: txns.length - newTxns.length };
}

// ─── Main import ──────────────────────────────────────────────────────────────

/**
 * Full import: fetch cards → pending + completed transactions → dedup → push to Supabase.
 * The caller must have already verified the OTP and obtained otpToken.
 */
export async function importCalTransactions(
  connectionId: string,
  otpToken: string,
  months: number,
  onProgress?: (msg: string) => void
): Promise<{ dbSessionId: string; imported: number; skipped: number }> {
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

  // Build month list
  const now = new Date();
  const monthYears: { month: number; year: number }[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthYears.push({ month: d.getMonth() + 1, year: d.getFullYear() });
  }

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

  // Create import session — requires INSERT policy (migration 031).
  // Falls back to null (nullable FK) if the insert fails for any reason.
  let dbSessionId: string | null = null;
  const { data: sessionRow } = await supabase
    .from('bank_import_sessions')
    .insert({ user_id: user.id, household_id: householdId, status: 'complete', completed_at: new Date().toISOString() })
    .select('id')
    .single();
  dbSessionId = (sessionRow as { id: string } | null)?.id ?? null;

  // Push to Supabase
  const { imported, skipped } = await pushToSupabase(allRawTxns, user.id, householdId, connectionId, dbSessionId);

  // Update last_sync_at
  await supabase
    .from('bank_connections')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('id', connectionId);

  log(`Done: ${imported} imported, ${skipped} skipped`);
  return { dbSessionId, imported, skipped };
}
