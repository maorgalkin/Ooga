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
 * Step 1: Trigger SMS OTP for the given connection.
 * Returns calSessionToken — a UUID to send back with the OTP code.
 */
export async function requestCalOtp(connectionId: string): Promise<string> {
  const res = await fetch('/api/cal-otp-request', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ connectionId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string; detail?: unknown };
    const detail = body.detail ? ` — ${JSON.stringify(body.detail)}` : '';
    throw new Error((body.error ?? 'Failed to request OTP') + detail);
  }
  const data = await res.json() as { calSessionToken: string };
  return data.calSessionToken;
}

/**
 * Step 2: Verify OTP, fetch all transactions, push to Supabase.
 * This is a single long-running request (up to Vercel's function timeout).
 */
export async function importCalTransactions(
  connectionId: string,
  calSessionToken: string,
  otpCode: string,
  months: number
): Promise<{ dbSessionId: string; imported: number; skipped: number }> {
  const res = await fetch('/api/cal-import', {
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
