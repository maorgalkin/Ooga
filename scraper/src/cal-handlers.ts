import { getUserAndHousehold, supabase } from './supabase-push.js';
import { loadCalCredentials, NotFoundError, requestCalOtp, verifyCalOtp } from './cal-otp.js';

type Handled = { status: number; body: Record<string, unknown> };

/**
 * The SMS sign-in for a Cal account whose ID the server holds encrypted. Any member of the
 * account's household may start it (the code still goes to the cardholder's phone). The app then
 * fetches transactions itself with the returned token; no transaction data passes through here.
 */
export async function handleOtpRequest(authHeader: string, body: unknown): Promise<Handled> {
  const { connectionId } = (body ?? {}) as { connectionId?: unknown };
  if (typeof connectionId !== 'string' || !connectionId) return { status: 400, body: { error: 'connectionId is required' } };

  let householdId: string;
  try {
    ({ householdId } = await getUserAndHousehold(authHeader));
  } catch {
    return { status: 401, body: { error: 'Sign in again to import.' } };
  }
  try {
    const creds = await loadCalCredentials(supabase, householdId, connectionId);
    const calSessionToken = await requestCalOtp(creds.id, creds.last4Digits);
    return { status: 200, body: { calSessionToken } };
  } catch (err) {
    if (err instanceof NotFoundError) return { status: 404, body: { error: 'Account not found' } };
    return { status: 400, body: { error: err instanceof Error ? err.message : 'OTP request failed' } };
  }
}

export async function handleOtpVerify(authHeader: string, body: unknown): Promise<Handled> {
  const { connectionId, calSessionToken, code } = (body ?? {}) as Record<string, unknown>;
  if (typeof connectionId !== 'string' || typeof calSessionToken !== 'string' || typeof code !== 'string' || !connectionId || !calSessionToken || !code) {
    return { status: 400, body: { error: 'connectionId, calSessionToken and code are required' } };
  }

  let householdId: string;
  try {
    ({ householdId } = await getUserAndHousehold(authHeader));
  } catch {
    return { status: 401, body: { error: 'Sign in again to import.' } };
  }
  try {
    const creds = await loadCalCredentials(supabase, householdId, connectionId);
    const otpToken = await verifyCalOtp(creds.id, calSessionToken, code.trim());
    return { status: 200, body: { otpToken } };
  } catch (err) {
    if (err instanceof NotFoundError) return { status: 404, body: { error: 'Account not found' } };
    return { status: 400, body: { error: err instanceof Error ? err.message : 'OTP verification failed' } };
  }
}

