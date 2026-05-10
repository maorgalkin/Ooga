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
import { requireAuth, getAdminClient, AuthError } from './supabase-admin';
import { loadCredentials } from './connections';
import { createHash } from 'crypto';

// ─── Cal API constants ──────────────────────────────────────────────────────

const OTP_URL = 'https://connect.cal-online.co.il/col-rest/calconnect/authentication/otp';
const AUTH_SITE_ID = '5B5160DD-F84A-4D72-B67E-65891BA194FF';
const TXN_SITE_ID = '09031987-273E-2311-906C-8AF85B17C8D9';

const FRAMES_URL = 'https://api.cal-online.co.il/Frames/api/Frames/GetFrameStatus';
const PENDING_URL = 'https://api.cal-online.co.il/Transactions/api/approvals/getClearanceRequests';
const TXN_URL = 'https://api.cal-online.co.il/Transactions/api/transactionsDetails/getCardTransactionsDetails';

// Candidate endpoints for discovering the user's cards
const CARDS_ENDPOINT_CANDIDATES = [
  'https://api.cal-online.co.il/Cards/api/Cards/GetCards',
  'https://api.cal-online.co.il/Cards/api/Cards/GetUserCards',
  'https://api.cal-online.co.il/api/init',
  'https://api.cal-online.co.il/api/Init',
];

// ─── Types ───────────────────────────────────────────────────────────────────

interface CalCard {
  cardUniqueId: string;
  last4Digits: string;
}

interface CalTransaction {
  merchantName?: string;
  transactionAmount?: number;
  chargedAmount?: number;
  debCrdDate?: string;
  transDate?: string;
  purchaseDate?: string;
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

function calAuthHeaders(calToken: string, siteId: string) {
  return {
    'Content-Type': 'application/json',
    'Authorization': `CALAuthScheme ${calToken}`,
    'X-Site-Id': siteId,
    'origin': 'https://digital-web.cal-online.co.il',
    'referer': 'https://digital-web.cal-online.co.il/',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  };
}

/**
 * Verify the OTP with Cal and return the calConnectToken used for API calls.
 * Also returns the full response body so we can search for card data.
 */
async function verifyOtp(
  custID: string,
  otpCode: string,
  calSessionToken: string
): Promise<{ calToken: string; fullResponse: Record<string, unknown> }> {
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

  // Extract the auth token — try multiple possible response shapes
  const calToken =
    extractString(body, ['calConnectToken']) ??
    extractString(body as any, ['auth', 'calConnectToken']) ??   // { auth: { calConnectToken } }
    extractString(body as any, ['result', 'calConnectToken']) ??
    extractString(body as any, ['data', 'calConnectToken']) ??
    extractString(body, ['token']);

  if (!calToken) {
    throw new Error(
      `Could not find calConnectToken in Cal response. Full response: ${JSON.stringify(body)}`
    );
  }

  return { calToken, fullResponse: body };
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
 * Discover the user's card IDs.
 *
 * Strategy (in order):
 * 1. Check if the OTP verify response included cards.
 * 2. Try known candidate card endpoints.
 * 3. Throw with helpful debug info if all fail.
 */
async function getCards(
  calToken: string,
  otpResponse: Record<string, unknown>
): Promise<CalCard[]> {
  // Strategy 1: OTP response may already contain cards
  const cardsFromAuth = extractCardsFromObject(otpResponse);
  if (cardsFromAuth) {
    console.log('[cal-import] Cards found in OTP verify response');
    return cardsFromAuth;
  }

  // Strategy 2: Try candidate endpoints
  const headers = calAuthHeaders(calToken, TXN_SITE_ID);
  for (const url of CARDS_ENDPOINT_CANDIDATES) {
    try {
      const res = await fetch(url, { method: 'GET', headers });
      if (!res.ok) continue;
      const body = await res.json().catch(() => null);
      if (!body) continue;
      const cards = extractCardsFromObject(body as Record<string, unknown>);
      if (cards && cards.length > 0) {
        console.log(`[cal-import] Cards found at: ${url}`);
        return cards;
      }
    } catch {
      // try next
    }
  }

  // Strategy 3: Try POST to Frames with empty array — some APIs return all cards
  try {
    const res = await fetch(FRAMES_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ cardsForFrameData: [] }),
    });
    if (res.ok) {
      const body = await res.json().catch(() => null) as Record<string, unknown>;
      if (body) {
        const cards = extractCardsFromObject(body);
        if (cards && cards.length > 0) {
          console.log('[cal-import] Cards found via Frames endpoint with empty array');
          return cards;
        }
      }
    }
  } catch { /* ignore */ }

  throw new Error(
    'Could not discover card IDs. Please capture a DevTools network request to api.cal-online.co.il ' +
    'that occurs after logging in to cal-online.co.il and share it. ' +
    `OTP response keys: ${Object.keys(otpResponse).join(', ')}`
  );
}

/** Search any response object for an array of cards with cardUniqueId. */
function extractCardsFromObject(obj: Record<string, unknown>): CalCard[] | null {
  if (!obj || typeof obj !== 'object') return null;

  // Direct: { cards: [{ cardUniqueId, last4Digits }] }
  for (const key of ['cards', 'result', 'data']) {
    const val = (obj as any)[key];
    if (Array.isArray(val) && val.length > 0 && val[0]?.cardUniqueId) {
      return val.map(({ cardUniqueId, last4Digits }: any) => ({ cardUniqueId, last4Digits }));
    }
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const nested = extractCardsFromObject(val as Record<string, unknown>);
      if (nested) return nested;
    }
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
    headers: calAuthHeaders(calToken, TXN_SITE_ID),
    body: JSON.stringify({ cardUniqueIDArray: [cardUniqueId] }),
  });
  if (!res.ok) return [];
  const body = await res.json().catch(() => ({})) as Record<string, unknown>;
  const list = body?.result as any;
  if (!list?.cardsList) return [];
  return list.cardsList.flatMap((c: any) => c.authDetalisList ?? []) as CalTransaction[];
}

async function fetchCompletedTransactions(
  calToken: string,
  cardUniqueId: string,
  month: number,
  year: number
): Promise<CalTransaction[]> {
  const res = await fetch(TXN_URL, {
    method: 'POST',
    headers: calAuthHeaders(calToken, TXN_SITE_ID),
    body: JSON.stringify({ cardUniqueId, month, year }),
  });
  if (!res.ok) return [];
  const body = await res.json().catch(() => ({})) as Record<string, unknown>;
  const result = (body as any)?.result;
  const txns: CalTransaction[] = [];
  if (result?.cardTransactionList) {
    for (const month of result.cardTransactionList) {
      if (month?.txnIsrael) txns.push(...month.txnIsrael);
      if (month?.txnAbroad) txns.push(...month.txnAbroad);
    }
  }
  return txns;
}

// ─── Transaction normalization ───────────────────────────────────────────────

function normalizeTransaction(
  tx: CalTransaction,
  cardUniqueId: string,
  isPending: boolean
): NormalizedTx {
  const chargedAmount = tx.chargedAmount ?? tx.transactionAmount ?? 0;
  const date = tx.debCrdDate ?? tx.transDate ?? tx.purchaseDate ?? new Date().toISOString();
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
    bank_card_last4: null,
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

    // Load credentials to get the custID (national ID)
    const creds = await loadCredentials(connectionId, userId);
    const custID = creds.userId;
    if (!custID) return res.status(400).json({ error: 'Stored credentials missing userId' });

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

    // Step 1: Verify OTP and get calConnectToken
    console.log('[cal-import] Verifying OTP…');
    const { calToken, fullResponse } = await verifyOtp(custID, otpCode, calSessionToken);
    console.log('[cal-import] OTP verified, token obtained');

    // Step 2: Get cards
    console.log('[cal-import] Discovering cards…');
    const cards = await getCards(calToken, fullResponse);
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
        const pending = await fetchPendingTransactions(calToken, card.cardUniqueId);
        allTxns.push(...pending.map((tx) => normalizeTransaction(tx, card.cardUniqueId, true)));

        // Completed transactions per month
        for (const { month, year } of monthYears) {
          const completed = await fetchCompletedTransactions(calToken, card.cardUniqueId, month, year);
          allTxns.push(...completed.map((tx) => normalizeTransaction(tx, card.cardUniqueId, false)));
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
