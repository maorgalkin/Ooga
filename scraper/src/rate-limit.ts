// In-memory limits on Cal's SMS sign-in, so the service can't be used to flood a phone with
// codes or guess one. They reset when the service restarts, which is fine at this scale; nginx
// adds a coarser per-address limit in front (scraper/nginx.conf).

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
export const SMS_MIN_GAP_MS = MINUTE;
export const SMS_PER_HOUR = 5;
export const CHECKS_PER_CODE = 5;
export const CHECKS_PER_USER_HOUR = 20;

const sends = new Map<string, number[]>();                          // key → when codes were sent, last hour
const checks = new Map<string, { count: number; first: number }>(); // account + Cal's handle → tries
const userChecks = new Map<string, number[]>();                      // person → when they checked, last hour

/**
 * Whether another SMS may be sent for all of `keys` (the account and the person): at most one a
 * minute and SMS_PER_HOUR an hour for each. Counts it when it may.
 */
export function allowSms(keys: string[], now = Date.now()): boolean {
  const recent = keys.map(k => (sends.get(k) ?? []).filter(t => now - t < HOUR));
  if (recent.some(r => r.length >= SMS_PER_HOUR || r.some(t => now - t < SMS_MIN_GAP_MS))) return false;
  keys.forEach((k, i) => sends.set(k, [...recent[i], now]));
  return true;
}

/**
 * Whether a code may be checked again: CHECKS_PER_CODE tries per sign-in (account and Cal's
 * handle), then ask for a new code; and CHECKS_PER_USER_HOUR tries an hour per person.
 */
export function allowCheck(connectionId: string, calSessionToken: string, userId: string, now = Date.now()): boolean {
  for (const [k, v] of checks) if (now - v.first > HOUR) checks.delete(k);
  const key = `${connectionId}:${calSessionToken.trim()}`;
  const entry = checks.get(key) ?? { count: 0, first: now };
  const recent = (userChecks.get(userId) ?? []).filter(t => now - t < HOUR);
  if (entry.count >= CHECKS_PER_CODE || recent.length >= CHECKS_PER_USER_HOUR) return false;
  checks.set(key, { ...entry, count: entry.count + 1 });
  userChecks.set(userId, [...recent, now]);
  return true;
}

/** For tests */
export function resetRateLimits(): void {
  sends.clear();
  checks.clear();
  userChecks.clear();
}
