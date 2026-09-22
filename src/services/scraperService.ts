/**
 * Client for the Ooga scraper service (scraper/ — runs israeli-bank-scrapers server-side).
 *
 * Used for accounts that can't be imported directly from the browser (e.g. Discount Bank).
 * Credentials are sent once, encrypted by the service with a key only it holds, and never
 * returned. Every request is authenticated with the user's Supabase session.
 */

import { supabase } from '../lib/supabase';

const SCRAPER_URL = (import.meta.env.VITE_SCRAPER_URL as string | undefined) ?? 'https://api.haooga.com';

export type ServerImportStatus = 'logging_in' | 'awaiting_otp' | 'importing' | 'complete' | 'error';

export interface SkippedCardBill {
  date: string;
  description: string;
  amount: number;
}

export interface ServerImportState {
  sessionId: string;
  dbSessionId: string | null;
  status: ServerImportStatus;
  result: { imported: number; skipped: number; skippedCardBills?: SkippedCardBill[] } | null;
  error: string | null;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  let res: Response;
  try {
    res = await fetch(`${SCRAPER_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        ...init.headers,
      },
    });
  } catch {
    throw new Error('The import service is unreachable. Try again in a minute.');
  }

  const body = await res.json().catch(() => ({})) as { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Import service error (HTTP ${res.status})`);
  return body as T;
}

/** Store a connection's credentials encrypted on the import service */
export async function addSecureConnection(
  provider: string,
  credentials: Record<string, string>,
  displayName: string
): Promise<{ id: string; provider: string; display_name: string }> {
  const { connection } = await request<{ connection: { id: string; provider: string; display_name: string } }>(
    '/connections/add',
    { method: 'POST', body: JSON.stringify({ provider, credentials, displayName }) }
  );
  return connection;
}

/** Start importing one connection; returns the session id to poll */
export async function startServerImport(connectionId: string, startDate: string, endDate: string): Promise<string> {
  const { sessionId } = await request<{ sessionId: string }>('/scrape/start', {
    method: 'POST',
    body: JSON.stringify({ connectionId, startDate, endDate }),
  });
  return sessionId;
}

export function getServerImportStatus(sessionId: string): Promise<ServerImportState> {
  return request<ServerImportState>(`/scrape/status/${encodeURIComponent(sessionId)}`);
}

/** Poll until the import finishes (complete or error). Bank logins can take a minute or two. */
export async function waitForServerImport(
  sessionId: string,
  onStatus?: (status: ServerImportStatus) => void,
  { intervalMs = 2000, timeoutMs = 4 * 60 * 1000 } = {}
): Promise<ServerImportState> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const state = await getServerImportStatus(sessionId);
    onStatus?.(state.status);
    if (state.status === 'complete' || state.status === 'error') return state;
    if (Date.now() > deadline) throw new Error('The import is taking too long. Check back in a few minutes.');
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
}
