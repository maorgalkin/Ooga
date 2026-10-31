import { getUserAndHousehold, supabase } from './supabase-push.js';
import { CalError, loadCalCredentials, NotFoundError, requestCalOtp, verifyCalOtp } from './cal-otp.js';
import { isUuid } from './scrape-guards.js';
import { allowCheck, allowSms } from './rate-limit.js';

type Handled = { status: number; body: Record<string, unknown> };

// What the browser is told. Only Cal's own refusals pass through as they are; anything else
// (the database, decryption) is a plain sentence, and only the error's name is logged.
const SEND_FAILED = "Couldn't send the SMS code. Try again.";
const CHECK_FAILED = "Couldn't check the SMS code. Try again.";
const TOO_MANY_SMS = 'Too many SMS requests. Try again in a minute.';
const TOO_MANY_CHECKS = 'Too many tries for this code. Ask for a new one.';

async function signedIn(authHeader: string): Promise<{ userId: string; householdId: string } | null> {
  try {
    return await getUserAndHousehold(authHeader);
  } catch {
    return null;
  }
}

function failure(err: unknown, fallback: string, what: string): Handled {
  if (err instanceof NotFoundError) return { status: 404, body: { error: 'Account not found' } };
  if (err instanceof CalError) return { status: 400, body: { error: err.message } };
  console.error(`Cal ${what} failed:`, err instanceof Error ? err.name : 'unknown');
  return { status: 500, body: { error: fallback } };
}

/**
 * The SMS sign-in for a Cal account whose ID the server holds encrypted. Any member of the
 * account's household may start it (the code still goes to the cardholder's phone), at most once
 * a minute and five times an hour per account and per person. The app then fetches transactions
 * itself with the returned token; no transaction data passes through here.
 */
export async function handleOtpRequest(authHeader: string, body: unknown): Promise<Handled> {
  const { connectionId } = (body ?? {}) as { connectionId?: unknown };
  if (!isUuid(connectionId)) return { status: 400, body: { error: 'connectionId is required' } };

  const caller = await signedIn(authHeader);
  if (!caller) return { status: 401, body: { error: 'Sign in again to import.' } };
  try {
    const creds = await loadCalCredentials(supabase, caller.householdId, connectionId);
    if (!allowSms([`connection:${connectionId}`, `user:${caller.userId}`])) return { status: 429, body: { error: TOO_MANY_SMS } };
    const calSessionToken = await requestCalOtp(creds.id, creds.last4Digits);
    return { status: 200, body: { calSessionToken } };
  } catch (err) {
    return failure(err, SEND_FAILED, 'SMS request');
  }
}

/** Checks the texted code: at most five tries per sign-in, then a new code is needed. */
export async function handleOtpVerify(authHeader: string, body: unknown): Promise<Handled> {
  const { connectionId, calSessionToken, code } = (body ?? {}) as Record<string, unknown>;
  if (!isUuid(connectionId) || typeof calSessionToken !== 'string' || typeof code !== 'string' || !calSessionToken || !code.trim()) {
    return { status: 400, body: { error: 'connectionId, calSessionToken and code are required' } };
  }

  const caller = await signedIn(authHeader);
  if (!caller) return { status: 401, body: { error: 'Sign in again to import.' } };
  try {
    const creds = await loadCalCredentials(supabase, caller.householdId, connectionId);
    if (!allowCheck(calSessionToken)) return { status: 429, body: { error: TOO_MANY_CHECKS } };
    const otpToken = await verifyCalOtp(creds.id, calSessionToken, code.trim());
    return { status: 200, body: { otpToken } };
  } catch (err) {
    return failure(err, CHECK_FAILED, 'SMS check');
  }
}
