import { supabase } from '../lib/supabase';

export type ImportStatus =
  | 'logging_in'
  | 'awaiting_otp'
  | 'importing'
  | 'complete'
  | 'error';

export interface ReviewTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  category_id: string | null;
  original_amount: number | null;
  original_currency: string | null;
  installment_number: number | null;
  installment_total: number | null;
  memo: string | null;
  bank_connection_id: string | null;
}

export interface BankConnection {
  id: string;
  provider: string;
  display_name: string;
  last_sync_at: string | null;
  is_active: boolean;
  created_at: string;
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

// ─── Connection management ────────────────────────────────────────────────────

export async function listConnections(): Promise<BankConnection[]> {
  const res = await fetch('/api/connections', { headers: await authHeaders() });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? 'Failed to list connections');
  }
  const data = await res.json() as { connections: BankConnection[] };
  return data.connections;
}

export async function addConnection(
  provider: string,
  credentials: Record<string, string>,
  displayName: string
): Promise<BankConnection> {
  const res = await fetch('/api/connections', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ provider, credentials, displayName }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? 'Failed to add connection');
  }
  const data = await res.json() as { connection: BankConnection };
  return data.connection;
}

export async function deleteConnection(connectionId: string): Promise<void> {
  const res = await fetch(`/api/connections?id=${connectionId}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? 'Failed to delete connection');
  }
}

// ─── Cal import flow ──────────────────────────────────────────────────────────

/**
 * Whether the local relay (localhost:9191) should be used.
 * Set to true after a successful relay-based OTP request, so the subsequent
 * cal-import call also routes through the relay.
 */
let _useRelay = false;

/** Returns 'http://localhost:9191' if relay is active, else '' (relative = Vercel). */
function baseUrl() { return _useRelay ? 'http://localhost:9191' : ''; }

/** Check if a Cal API response body is a WAF-blocked HTML page. */
function isWafBlock(body: { rawPreview?: string; calStatus?: number }): boolean {
  return body.calStatus === 400 && typeof body.rawPreview === 'string' &&
    (body.rawPreview.includes('Request Rejected') || body.rawPreview.includes('BIG-IP'));
}

/**
 * Step 1: Trigger SMS OTP for the given connection.
 * Returns calSessionToken — a UUID to send back with the OTP code.
 *
 * Automatically retries via local relay (localhost:9191) if Vercel's IP
 * is WAF-blocked by Cal's F5 BIG-IP.
 */
export async function requestCalOtp(connectionId: string): Promise<string> {
  const headers = await authHeaders();
  const body = JSON.stringify({ connectionId });

  async function attempt(base: string): Promise<Response> {
    return fetch(`${base}/api/cal-otp-request`, { method: 'POST', headers, body });
  }

  let res = await attempt(baseUrl());

  // Auto-retry via relay if Vercel is WAF-blocked
  if (!res.ok && !_useRelay) {
    const errBody = await res.json().catch(() => ({})) as { rawPreview?: string; calStatus?: number };
    if (isWafBlock(errBody)) {
      console.info('[bankImport] Vercel IP blocked by Cal WAF — retrying via local relay');
      try {
        const relayRes = await attempt('http://localhost:9191');
        if (relayRes.ok) {
          _useRelay = true;
          res = relayRes;
        } else {
          const relayErr = await relayRes.json().catch(() => ({})) as { error?: string };
          throw new Error(
            `Cal API blocked on Vercel (IP blocked). Local relay also failed: ${relayErr.error ?? relayRes.status}.\n` +
            `Start the relay: node --env-file=.env.relay relay.js`
          );
        }
      } catch (e) {
        if (e instanceof Error && e.message.includes('relay also failed')) throw e;
        // Connection refused = relay not running
        throw new Error(
          'Cal API blocked on Vercel (WAF/IP block).\n' +
          'Start the local relay on your Mac:\n  node --env-file=.env.relay relay.js\nThen try again.'
        );
      }
    }
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({})) as { error?: string; detail?: unknown; calStatus?: number; rawPreview?: string };
    const extra = [
      errBody.calStatus ? `HTTP ${errBody.calStatus}` : null,
      errBody.rawPreview ? errBody.rawPreview.slice(0, 150) : (errBody.detail ? JSON.stringify(errBody.detail) : null),
    ].filter(Boolean).join(' | ');
    throw new Error((errBody.error ?? 'Failed to request OTP') + (extra ? ` — ${extra}` : ''));
  }
  const data = await res.json() as { calSessionToken: string };
  return data.calSessionToken;
}

/**
 * Step 2: Verify OTP, fetch all transactions, push to Supabase.
 * Routes through the local relay if OTP was relay-assisted (_useRelay flag).
 */
export async function importCalTransactions(
  connectionId: string,
  calSessionToken: string,
  otpCode: string,
  months: number
): Promise<{ dbSessionId: string; imported: number; skipped: number }> {
  const res = await fetch(`${baseUrl()}/api/cal-import`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ connectionId, calSessionToken, otpCode, months }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? 'Import failed');
  }
  return res.json() as Promise<{ dbSessionId: string; imported: number; skipped: number }>;
}

// ─── Import review (direct Supabase queries) ──────────────────────────────────

export async function fetchImportedTransactions(dbSessionId: string): Promise<ReviewTransaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('id, date, description, amount, type, category, category_id, original_amount, original_currency, installment_number, installment_total, memo, bank_connection_id')
    .eq('import_session_id', dbSessionId)
    .order('date', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as ReviewTransaction[];
}

export async function updateTransactionCategory(
  id: string,
  categoryId: string | null,
  categoryName: string
): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .update({ category: categoryName, category_id: categoryId })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function deleteTransactions(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from('transactions')
    .delete()
    .in('id', ids);

  if (error) throw new Error(error.message);
}
