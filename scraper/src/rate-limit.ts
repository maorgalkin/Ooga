// In-memory limits on Cal's SMS sign-in, so the service can't be used to flood a phone with
// codes or guess one. They reset when the service restarts, which is fine at this scale; nginx
// adds a coarser per-address limit in front (scraper/nginx.conf).

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
export const SMS_MIN_GAP_MS = MINUTE;
export const SMS_PER_HOUR = 5;
export const CHECKS_PER_CODE = 5;

const sends = new Map<string, number[]>();                          // key → when codes were sent, last hour
const checks = new Map<string, { count: number; first: number }>(); // Cal's handle → tries

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

/** Whether a code may be checked again for this sign-in: CHECKS_PER_CODE tries, then ask for a new code. */
export function allowCheck(calSessionToken: string, now = Date.now()): boolean {
  for (const [k, v] of checks) if (now - v.first > HOUR) checks.delete(k);
  const entry = checks.get(calSessionToken) ?? { count: 0, first: now };
  if (entry.count >= CHECKS_PER_CODE) return false;
  checks.set(calSessionToken, { ...entry, count: entry.count + 1 });
  return true;
}

/** For tests */
export function resetRateLimits(): void {
  sends.clear();
  checks.clear();
}
