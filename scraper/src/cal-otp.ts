// Cal's SMS sign-in, called by the server so the cardholder's national ID never reaches a
// browser (it's decrypted here, used, and dropped). The calls match the app's own
// (src/services/calDirectService.ts requestCalOtp / verifyCalOtp). Never log the ID, the code or
// the tokens.
import type { Db } from './staging.js';
import { decrypt } from './encryption.js';

const OTP_URL = 'https://connect.cal-online.co.il/col-rest/calconnect/authentication/otp';
const AUTH_SITE_ID = '5B5160DD-F84A-4D72-B67E-65891BA194FF';

/** A refusal from Cal itself; its message ("OTP request failed: …") is safe to show */
export class CalError extends Error {
  name = 'CalError';
}

function calConnectHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-site-id': AUTH_SITE_ID,
    'origin': 'https://connect.cal-online.co.il',
    'referer': 'https://connect.cal-online.co.il/send-otp',
  };
}

/** Asks Cal to text the code to the cardholder; returns Cal's handle for this sign-in. */
export async function requestCalOtp(nationalId: string, last4Digits: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const res = await fetchImpl(OTP_URL, {
    method: 'PUT',
    headers: calConnectHeaders(),
    body: JSON.stringify({ userId: nationalId, last4Digits, bankAccountNum: last4Digits, sMSTemplate: null, recaptcha: '' }),
  });
  const body = await res.json().catch(() => ({})) as Record<string, unknown>;
  if (!res.ok) throw new CalError(`OTP request failed: ${(body.message ?? body.error ?? `HTTP ${res.status}`) as string}`);

  const token = (body.token ?? (body.result as Record<string, unknown>)?.token ?? body.sessionToken) as string | undefined;
  if (!token) throw new CalError('OTP request failed: no session token in the response');
  return token;
}

/** Checks the texted code; returns Cal's short-lived token the browser fetches transactions with. */
export async function verifyCalOtp(nationalId: string, calSessionToken: string, code: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const res = await fetchImpl(OTP_URL, {
    method: 'POST',
    headers: calConnectHeaders(),
    body: JSON.stringify({ custID: nationalId, password: code, token: calSessionToken }),
  });
  const body = await res.json().catch(() => ({})) as Record<string, unknown>;
  if (!res.ok) throw new CalError(`OTP verification failed: ${(body.message ?? body.error ?? body.description ?? `HTTP ${res.status}`) as string}`);

  const token = body.token as string | undefined;
  if (!token) throw new CalError('OTP verification failed: no token in the response');
  return token;
}

export class NotFoundError extends Error {
  name = 'NotFoundError';
}

/**
 * A Cal connection's ID and card digits, for a member of its household. Throws NotFoundError for
 * an unknown connection, another household's, or one without server-held details (the app then
 * uses its own flow).
 */
export async function loadCalCredentials(db: Db, householdId: string, connectionId: string): Promise<{ id: string; last4Digits: string }> {
  const { data, error } = await db
    .from('bank_connections')
    .select('provider, credentials_encrypted')
    .eq('id', connectionId)
    .eq('household_id', householdId)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw new Error("Couldn't read the account");
  if (!data || data.provider !== 'visaCalFast' || !data.credentials_encrypted) throw new NotFoundError('Account not found');

  const creds = JSON.parse(decrypt(data.credentials_encrypted)) as Record<string, unknown>;
  const id = typeof creds.id === 'string' ? creds.id : '';
  const last4Digits = typeof creds.last4Digits === 'string' ? creds.last4Digits : '';
  if (!id) throw new NotFoundError('Account not found');
  return { id, last4Digits };
}
