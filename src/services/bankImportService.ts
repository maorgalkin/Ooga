import { supabase } from '../lib/supabase';

// If no explicit URL is configured, use the same hostname as the page
// (works on any device on the LAN — phone, tablet, Mac).
function getScraperUrl(): string {
  if (import.meta.env.VITE_SCRAPER_SERVICE_URL) {
    return import.meta.env.VITE_SCRAPER_SERVICE_URL as string;
  }
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:3001`;
}

const SCRAPER_URL = getScraperUrl();
const SCRAPER_API_KEY = import.meta.env.VITE_SCRAPER_API_KEY ?? '';

export type ImportStatus =
  | 'logging_in'
  | 'awaiting_otp'
  | 'importing'
  | 'complete'
  | 'error';

export interface ImportStatusResponse {
  sessionId: string;
  dbSessionId: string | null;
  status: ImportStatus;
  result: { imported: number; skipped: number } | null;
  error: string | null;
}

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

function baseHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (SCRAPER_API_KEY) h['x-api-key'] = SCRAPER_API_KEY;
  return h;
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function authedHeaders(): Promise<Record<string, string>> {
  return { ...baseHeaders(), ...(await authHeaders()) };
}

// ─── Import ─────────────────────────────────────────────────────────────────

export async function startImport(months = 3): Promise<string> {
  const res = await fetch(`${SCRAPER_URL}/scrape/start`, {
    method: 'POST',
    headers: await authedHeaders(),
    body: JSON.stringify({ months }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? 'Failed to start import');
  }

  const data = await res.json() as { sessionId: string };
  return data.sessionId;
}

export async function submitOtp(sessionId: string, code: string): Promise<void> {
  const res = await fetch(`${SCRAPER_URL}/scrape/otp`, {
    method: 'POST',
    headers: baseHeaders(),
    body: JSON.stringify({ sessionId, code }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? 'Failed to submit OTP');
  }
}

export async function getImportStatus(sessionId: string): Promise<ImportStatusResponse> {
  const res = await fetch(`${SCRAPER_URL}/scrape/status/${sessionId}`, {
    headers: baseHeaders(),
  });

  if (!res.ok) {
    throw new Error('Failed to get import status');
  }

  return res.json() as Promise<ImportStatusResponse>;
}

export async function checkScraperHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${SCRAPER_URL}/health`, { signal: AbortSignal.timeout(8000) });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Connection management ───────────────────────────────────────────────────

export async function listConnections(): Promise<BankConnection[]> {
  const res = await fetch(`${SCRAPER_URL}/connections/list`, {
    headers: await authedHeaders(),
  });
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
  const res = await fetch(`${SCRAPER_URL}/connections/add`, {
    method: 'POST',
    headers: await authedHeaders(),
    body: JSON.stringify({ provider, credentials, displayName }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? 'Failed to add connection');
  }
  const data = await res.json() as { connection: BankConnection };
  return data.connection;
}

export async function testConnection(connectionId: string): Promise<void> {
  const res = await fetch(`${SCRAPER_URL}/connections/test/${connectionId}`, {
    method: 'POST',
    headers: await authedHeaders(),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? 'Connection test failed');
  }
}

export async function deleteConnection(connectionId: string): Promise<void> {
  const res = await fetch(`${SCRAPER_URL}/connections/${connectionId}`, {
    method: 'DELETE',
    headers: await authedHeaders(),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? 'Failed to delete connection');
  }
}

// ─── Import review (direct Supabase queries) ─────────────────────────────────

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
