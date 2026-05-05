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
  status: ImportStatus;
  result: { imported: number; skipped: number } | null;
  error: string | null;
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

export async function startImport(months = 3): Promise<string> {
  const res = await fetch(`${SCRAPER_URL}/scrape/start`, {
    method: 'POST',
    headers: { ...baseHeaders(), ...(await authHeaders()) },
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
    const res = await fetch(`${SCRAPER_URL}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}
