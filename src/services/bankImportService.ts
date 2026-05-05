const SCRAPER_URL = import.meta.env.VITE_SCRAPER_SERVICE_URL ?? 'http://localhost:3001';
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

function headers(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (SCRAPER_API_KEY) h['x-api-key'] = SCRAPER_API_KEY;
  return h;
}

function userAuthHeader(): Record<string, string> {
  // The Supabase session token is stored in localStorage by the Supabase JS client.
  // We pass it to the scraper so it can look up the user + household.
  const raw = localStorage.getItem(
    `sb-${import.meta.env.VITE_SUPABASE_URL?.match(/\/\/([^.]+)/)?.[1]}-auth-token`
  );
  const parsed = raw ? (JSON.parse(raw) as { access_token?: string }) : null;
  const token = parsed?.access_token ?? '';
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function startImport(months = 3): Promise<string> {
  const res = await fetch(`${SCRAPER_URL}/scrape/start`, {
    method: 'POST',
    headers: { ...headers(), ...userAuthHeader() },
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
    headers: headers(),
    body: JSON.stringify({ sessionId, code }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? 'Failed to submit OTP');
  }
}

export async function getImportStatus(sessionId: string): Promise<ImportStatusResponse> {
  const res = await fetch(`${SCRAPER_URL}/scrape/status/${sessionId}`, {
    headers: headers(),
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
