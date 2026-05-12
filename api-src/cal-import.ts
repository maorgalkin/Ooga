/**
 * Step 2 of Cal Fast Access import: verify OTP → fetch transactions → store in Supabase.
 *
 * POST /api/cal-import
 * Body: {
 *   connectionId:    string   — which bank_connection to import from
 *   calSessionToken: string   — UUID returned by /api/cal-otp-request
 *   otpCode:         string   — 6-digit code from user's phone
 *   months:          number   — how many months to fetch (default 3)
 * }
 * Response: { dbSessionId: string, imported: number, skipped: number }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, getAdminClient, AuthError } from '../lib/supabase-admin';
import { loadCredentials } from '../lib/bank-helpers';
import { createHash } from 'crypto';

// ─── Cal API constants ──────────────────────────────────────────────────────

const OTP_URL = 'https://connect.cal-online.co.il/col-rest/calconnect/authentication/otp';
const AUTH_SITE_ID = '5B5160DD-F84A-4D72-B67E-65891BA194FF';
const TXN_SITE_ID = '09031987-273E-2311-906C-8AF85B17C8D9';

// SSO exchange: POST {otpToken, sessionID} → {result: {calConnectToken}}
const SSO_FOR_IVR_URL = 'https://api.cal-online.co.il/Authentication/api/SSO/GetSSOForIvr';
// Account init: POST {tokenGuid:''} → {result: {cards:[{cardUniqueId,last4Digits}],...}}
// Discovered from Noam5/israel-credit-card-crawlers Python scraper
const ACCOUNT_INIT_URL = 'https://api.cal-online.co.il/Authentication/api/account/init';

const PENDING_URL = 'https://api.cal-online.co.il/Transactions/api/approvals/getClearanceRequests';
const TXN_URL = 'https://api.cal-online.co.il/Transactions/api/transactionsDetails/getCardTransactionsDetails';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CalCard {
  cardUniqueId: string;
  last4Digits: string;
}

interface CalTransaction {
  merchantName?: string;
  transactionAmount?: number;
  chargedAmount?: number;
  authAmount?: number;        // pending transactions use authAmount
  activityAmount?: number;    // alternate amount field
  debCrdDate?: string;
  transDate?: string;
  purchaseDate?: string;
  activityDate?: string;      // pending txn date field
  trnCurrencySymbol?: string;
  debCrdCurrencySymbol?: string;
  transTypeCommentDetails?: unknown;
  branchCodeDesc?: string;
  trnTypeCode?: string;
  installmentsNumber?: number;
  currentPaymentNum?: number;
  cardUniqueId?: string;
  [key: string]: unknown;
}

// ─── Cal API helpers ──────────────────────────────────────────────────────────

/** Headers for api.cal-online.co.il — uses CALAuthScheme + TXN site ID */
function calApiHeaders(calToken: string) {
  return {
    'Content-Type': 'application/json',
    'Authorization': `CALAuthScheme ${calToken}`,
    'X-Site-Id': TXN_SITE_ID,
    'origin': 'https://digital-web.cal-online.co.il',
    'referer': 'https://digital-web.cal-online.co.il/',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  };
}

/** Headers for connect.cal-online.co.il — uses calconnecttoken header + AUTH site ID */
function calConnectHeaders(calToken: string) {
  return {
    'Content-Type': 'application/json',
    'calconnecttoken': calToken,
    'x-site-id': AUTH_SITE_ID,
    'origin': 'https://connect.cal-online.co.il',
    'referer': 'https://connect.cal-online.co.il/',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  };
}

/**
 * Step 2: Verify OTP with Cal.
 * Returns { otpToken, fullResponse } — otpToken is the connect-domain session token.
 * This is NOT the calConnectToken for api.cal-online.co.il yet.
 */
async function verifyOtp(
  custID: string,
  otpCode: string,
  calSessionToken: string
): Promise<{ otpToken: string; fullResponse: Record<string, unknown> }> {
  const res = await fetch(OTP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-site-id': AUTH_SITE_ID,
      'origin': 'https://connect.cal-online.co.il',
      'referer': 'https://connect.cal-online.co.il/verify-otp',
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    },
    body: JSON.stringify({ custID, password: otpCode, token: calSessionToken }),
  });

  const body = await res.json().catch(() => ({})) as Record<string, unknown>;

  if (!res.ok) {
    const msg = extractString(body, ['message', 'error', 'description']) ?? `HTTP ${res.status}`;
    throw new Error(`OTP verification failed: ${msg}`);
  }

  const otpToken = extractString(body, ['token']);
  if (!otpToken) {
    throw new Error(`OTP verify response missing 'token'. Keys: ${Object.keys(body).join(', ')}`);
  }

  console.log('[cal-import] OTP verified. Response keys:', Object.keys(body).join(', '));
  return { otpToken, fullResponse: body };
}

/**
 * Step 3: Exchange the OTP connect-domain token for a calConnectToken usable on api.cal-online.co.il.
 *
 * Tries multiple strategies in order:
 * 1. POST GetSSOForIvr {otpToken, sessionID} with TXN_SITE_ID
 * 2. POST GetSSOForIvr with AUTH_SITE_ID (in case auth domain uses different site)
 * 3. otpToken directly (the POST /otp token may already be the calConnectToken for web OTP flow)
 *
 * Returns the calConnectToken string, or throws if all strategies fail.
 */
async function getSsoForIvr(otpToken: string, sessionID: string): Promise<string> {
  const ssoAttempts = [
    { siteId: TXN_SITE_ID, label: 'TXN_SITE_ID' },
    { siteId: AUTH_SITE_ID, label: 'AUTH_SITE_ID' },
  ];

  for (const { siteId, label } of ssoAttempts) {
    try {
      const res = await fetch(SSO_FOR_IVR_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Site-Id': siteId,
          'origin': 'https://digital-web.cal-online.co.il',
          'referer': 'https://digital-web.cal-online.co.il/',
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
        body: JSON.stringify({ otpToken, sessionID }),
      });

      const body = await res.json().catch(() => ({})) as Record<string, unknown>;
      const statusCode = (body as any)?.statusCode as number | undefined;
      console.log(`[cal-import] GetSSOForIvr (${label}) HTTP ${res.status} statusCode=${statusCode}`,
        'body:', JSON.stringify(body).slice(0, 300));

      const calConnectToken =
        extractString(body as any, ['result', 'calConnectToken']) ??
        extractString(body, ['calConnectToken']) ??
        extractString(body as any, ['auth', 'calConnectToken']);

      if (calConnectToken) {
        console.log(`[cal-import] Got calConnectToken via GetSSOForIvr (${label})`);
        return calConnectToken;
      }
    } catch (e) {
      console.log(`[cal-import] GetSSOForIvr (${label}) threw:`, (e as Error).message);
    }
  }

  // Fallback: otpToken (from POST /otp) may itself be the calConnectToken for the web OTP flow.
  // GetSSOForIvr is used by the IVR integration; web OTP may not need it.
  console.log('[cal-import] GetSSOForIvr exhausted — trying otpToken directly as calConnectToken');
  return otpToken;
}

/** Deep-get a string value from an object using a path of keys. */
function extractString(obj: Record<string, unknown>, path: string[]): string | null {
  let cur: unknown = obj;
  for (const key of path) {
    if (cur == null || typeof cur !== 'object') return null;
    cur = (cur as Record<string, unknown>)[key];
  }
  return typeof cur === 'string' && cur.length > 0 ? cur : null;
}

/**
 * Step 4: Fetch cards using calConnectToken.
 *
 * Primary: POST Authentication/api/account/init {tokenGuid:''} → {result:{cards:[...]}}
 * Discovered from Noam5/israel-credit-card-crawlers Python scraper.
 */
async function getCards(calConnectToken: string): Promise<CalCard[]> {
  // ── Primary: account/init (confirmed working endpoint from open-source scraper) ─
  try {
    const res = await fetch(ACCOUNT_INIT_URL, {
      method: 'POST',
      headers: calApiHeaders(calConnectToken),
      body: JSON.stringify({ tokenGuid: '' }),
    });
    const body = await res.json().catch(() => null) as Record<string, unknown>;
    const sc = (body as any)?.statusCode;
    console.log('[cal-import] account/init HTTP', res.status, 'sc:', sc,
      'result keys:', (body as any)?.result ? Object.keys((body as any).result).join(', ') : null,
      'snippet:', JSON.stringify(body).slice(0, 500));
    if (res.ok && body) {
      const cards = extractCardsFromObject(body);
      if (cards && cards.length > 0) {
        console.log('[cal-import] Cards found via account/init:', cards.length);
        return cards;
      }
    }
  } catch (e) {
    console.log('[cal-import] account/init threw:', (e as Error).message);
  }

  throw new Error('Could not discover card IDs. Check relay logs for account/init response.');
}

/** Search any response object for an array of cards with cardUniqueId (deep, all keys). */
function extractCardsFromObject(obj: unknown, depth = 0): CalCard[] | null {
  if (depth > 6 || obj == null || typeof obj !== 'object') return null;
  if (Array.isArray(obj)) {
    if (obj.length > 0 && (obj[0] as any)?.cardUniqueId) {
      return (obj as any[]).map(({ cardUniqueId, last4Digits }: any) => ({ cardUniqueId, last4Digits }));
    }
    for (const item of obj) {
      const r = extractCardsFromObject(item, depth + 1);
      if (r) return r;
    }
    return null;
  }
  // Check all keys, not just known names
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    const val = (obj as Record<string, unknown>)[key];
    if (Array.isArray(val) && val.length > 0 && (val[0] as any)?.cardUniqueId) {
      return (val as any[]).map(({ cardUniqueId, last4Digits }: any) => ({ cardUniqueId, last4Digits }));
    }
    const nested = extractCardsFromObject(val, depth + 1);
    if (nested) return nested;
  }
  return null;
}

// ─── Transaction fetching ────────────────────────────────────────────────────

async function fetchPendingTransactions(
  calToken: string,
  cardUniqueId: string
): Promise<CalTransaction[]> {
  const res = await fetch(PENDING_URL, {
    method: 'POST',
    headers: calApiHeaders(calToken),
    body: JSON.stringify({ cardUniqueIDArray: [cardUniqueId] }),
  });
  if (!res.ok) return [];
  const body = await res.json().catch(() => ({})) as Record<string, unknown>;
  const list = body?.result as any;
  if (!list?.cardsList) return [];
  const txns = list.cardsList.flatMap((c: any) => c.authDetalisList ?? []) as CalTransaction[];
  if (txns.length > 0) {
    console.log('[cal-import] Pending txn sample keys:', Object.keys(txns[0] as any).join(','));
  }
  return txns;
}

async function fetchCompletedTransactions(
  calToken: string,
  cardUniqueId: string,
  month: number,
  year: number
): Promise<CalTransaction[]> {
  const res = await fetch(TXN_URL, {
    method: 'POST',
    headers: calApiHeaders(calToken),
    body: JSON.stringify({ cardUniqueId, month: String(month), year: String(year) }),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    console.log(`[cal-import] fetchCompleted HTTP ${res.status} for card ${cardUniqueId} ${month}/${year} body: ${errBody.slice(0, 200)}`);
    return [];
  }
  const body = await res.json().catch(() => ({})) as Record<string, unknown>;
  const result = (body as any)?.result;
  console.log(`[cal-import] fetchCompleted ${month}/${year} card=${cardUniqueId.slice(-4)} result keys: ${result ? Object.keys(result).join(',') : 'null'}`);
  const txns: CalTransaction[] = [];
  // Confirmed structure: result.bankAccounts[0].debitDates[0].txnIsrael / txnAbroad
  if (result?.bankAccounts) {
    for (const acct of result.bankAccounts) {
      for (const dd of acct?.debitDates ?? []) {
        if (dd?.txnIsrael) txns.push(...dd.txnIsrael);
        if (dd?.txnAbroad) txns.push(...dd.txnAbroad);
        if (dd?.transactions) txns.push(...dd.transactions); // fallback
      }
    }
  } else if (result?.cardTransactionList) {
    for (const item of result.cardTransactionList) {
      if (item?.txnIsrael) txns.push(...item.txnIsrael);
      if (item?.txnAbroad) txns.push(...item.txnAbroad);
    }
  }
  console.log(`[cal-import] fetchCompleted ${month}/${year} card=${cardUniqueId.slice(-4)} => ${txns.length} txns`);
  return txns;
}

// ─── Transaction normalization ───────────────────────────────────────────────

function normalizeTransaction(
  tx: CalTransaction,
  cardUniqueId: string,
  isPending: boolean,
  cardLast4: string | null = null
): NormalizedTx {
  const chargedAmount = tx.chargedAmount ?? tx.transactionAmount ?? tx.authAmount ?? tx.activityAmount ?? 0;
  const date = tx.debCrdDate ?? tx.activityDate ?? tx.transDate ?? tx.purchaseDate ?? new Date().toISOString();
  const description = tx.merchantName ?? 'Unknown';

  const dedupeHash = createHash('sha256')
    .update(`${date.slice(0, 10)}|${chargedAmount}|${description}`)
    .digest('hex');

  return {
    date: date.slice(0, 10),
    description,
    amount: Math.abs(chargedAmount),
    type: chargedAmount < 0 ? 'income' : 'expense',
    category: 'Uncategorized',
    original_amount: tx.transactionAmount != null && tx.transactionAmount !== chargedAmount
      ? tx.transactionAmount
      : null,
    original_currency: tx.trnCurrencySymbol ?? null,
    processed_date: isPending ? null : (tx.debCrdDate?.slice(0, 10) ?? null),
    installment_number: tx.currentPaymentNum ?? null,
    installment_total: tx.installmentsNumber ?? null,
    memo: tx.transTypeCommentDetails ? String(tx.transTypeCommentDetails) : null,
    bank_card_last4: cardLast4,
    dedupe_hash: dedupeHash,
    status: isPending ? 'pending' : 'completed',
    _cardUniqueId: cardUniqueId,
  };
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

// ─── Supabase push ───────────────────────────────────────────────────────────

async function pushToSupabase(
  txns: NormalizedTx[],
  userId: string,
  householdId: string,
  connectionId: string,
  dbSessionId: string
): Promise<{ imported: number; skipped: number }> {
  const supabase = getAdminClient();

  // Dedup: check which hashes already exist
  const hashes = txns.map((t) => t.dedupe_hash);
  const { data: existing } = await supabase
    .from('transactions')
    .select('dedupe_hash')
    .eq('household_id', householdId)
    .in('dedupe_hash', hashes);

  const existingSet = new Set((existing ?? []).map((r: any) => r.dedupe_hash));
  const newTxns = txns.filter((t) => !existingSet.has(t.dedupe_hash));

  if (newTxns.length === 0) {
    return { imported: 0, skipped: txns.length };
  }

  const rows = newTxns.map(({ _cardUniqueId: _, dedupe_hash, ...tx }) => ({
    ...tx,
    dedupe_hash,
    user_id: userId,
    household_id: householdId,
    bank_connection_id: connectionId,
    import_session_id: dbSessionId,
  }));

  const { error } = await supabase.from('transactions').insert(rows);
  if (error) throw new Error(`Supabase insert failed: ${error.message}`);

  return { imported: newTxns.length, skipped: txns.length - newTxns.length };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const userId = await requireAuth(req as any);
    const {
      connectionId,
      calSessionToken,
      otpCode,
      months = 3,
    } = req.body as {
      connectionId: string;
      calSessionToken: string;
      otpCode: string;
      months?: number;
    };

    if (!connectionId || !calSessionToken || !otpCode) {
      return res.status(400).json({ error: 'connectionId, calSessionToken, and otpCode are required' });
    }

    // Load credentials — stored as { id: "<national_id>", last4Digits: "..." }
    const creds = await loadCredentials(connectionId, userId);
    const custID = creds.id ?? creds.userId; // 'id' is the national ID field key used by AddBankAccountModal
    if (!custID) return res.status(400).json({ error: 'Stored credentials missing national ID (id field)' });

    // Get household_id
    const supabase = getAdminClient();
    const { data: hh } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', userId)
      .limit(1)
      .single();
    if (!hh) return res.status(400).json({ error: 'No household found for user' });
    const householdId = hh.household_id as string;

    // Step 1: Verify OTP — returns connect-domain session token
    console.log('[cal-import] Verifying OTP…');
    const { otpToken, fullResponse } = await verifyOtp(custID, otpCode, calSessionToken);
    console.log('[cal-import] OTP verified');

    // Step 2: Exchange OTP token for calConnectToken (api-domain token)
    // POST GetSSOForIvr {otpToken, sessionID} → {result: {calConnectToken}}
    console.log('[cal-import] Exchanging OTP token for calConnectToken via GetSSOForIvr…');
    const calConnectToken = await getSsoForIvr(otpToken, calSessionToken);

    // Step 3: Get cards from CalOnlineMetadata
    console.log('[cal-import] Discovering cards…');
    const cards = await getCards(calConnectToken);
    console.log(`[cal-import] Found ${cards.length} card(s):`, cards.map((c) => c.last4Digits));

    // Step 3: Fetch transactions for all cards × all months
    const now = new Date();
    const monthYears: { month: number; year: number }[] = [];
    for (let i = 0; i < months; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthYears.push({ month: d.getMonth() + 1, year: d.getFullYear() });
    }

    const allTxns: NormalizedTx[] = [];
    await Promise.all(
      cards.map(async (card) => {
        // Pending transactions (once per card, not per month)
        const pending = await fetchPendingTransactions(calConnectToken, card.cardUniqueId);
        allTxns.push(...pending.map((tx) => normalizeTransaction(tx, card.cardUniqueId, true, card.last4Digits)));

        // Completed transactions per month
        for (const { month, year } of monthYears) {
          const completed = await fetchCompletedTransactions(calConnectToken, card.cardUniqueId, month, year);
          allTxns.push(...completed.map((tx) => normalizeTransaction(tx, card.cardUniqueId, false, card.last4Digits)));
        }
      })
    );

    console.log(`[cal-import] Fetched ${allTxns.length} raw transactions`);

    // Step 4: Create a DB import session
    const { data: sessionRow } = await supabase
      .from('bank_import_sessions')
      .insert({
        user_id: userId,
        household_id: householdId,
        status: 'complete',
        completed_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    const dbSessionId = sessionRow?.id ?? crypto.randomUUID();

    // Step 5: Store in Supabase
    const { imported, skipped } = await pushToSupabase(
      allTxns,
      userId,
      householdId,
      connectionId,
      dbSessionId
    );

    // Update last_sync_at on the connection
    await supabase
      .from('bank_connections')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', connectionId);

    console.log(`[cal-import] Done: ${imported} imported, ${skipped} skipped`);
    return res.json({ dbSessionId, imported, skipped });
  } catch (err) {
    if (err instanceof AuthError) return res.status(401).json({ error: err.message });
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[cal-import]', message);
    return res.status(500).json({ error: message });
  }
}
