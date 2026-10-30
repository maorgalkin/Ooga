/**
 * Messages that services and the import server throw on purpose, each with the sentence people
 * see instead. Services keep throwing their English messages (logs and other callers rely on
 * them); screens show `errorMessage(...)`, in the reader's language.
 */
const KNOWN: [RegExp, string][] = [
  [/import service is unreachable/i, 'errors.importUnreachable'],
  [/import is taking too long/i, 'errors.importTimeout'],
  [/^(user )?not authenticated$/i, 'errors.signedOut'],
  [/not (a )?part of (a|any) household|not a member of this household|no household found|only household members can/i, 'errors.noHousehold'],
  [/owner cannot leave household/i, 'errors.ownerCannotLeave'],
  [/only (the household )?owners? can/i, 'errors.ownerOnly'],
  [/new owner (not found|must be a member)/i, 'errors.newOwnerNotMember'],
  [/already the owner/i, 'errors.alreadyOwner'],
  [/invalid invitation code|^household not found$/i, 'errors.invalidInvitation'],
  [/missing national id/i, 'errors.reconnectAccount'],
  [/no cards found on account/i, 'errors.noCards'],
  [/^OTP verification failed/i, 'errors.otpRejected'],
  [/^OTP request failed/i, 'errors.otpRequestFailed'],
  // israeli-bank-scrapers' login failures, as the import server passes them on
  [/change.?password/i, 'errors.bankPasswordExpired'],
  [/invalid.?password|wrong.?password|invalid credentials|login failed/i, 'errors.bankLoginRejected'],
  [/locked monthly budget/i, 'errors.budgetLocked'],
  [/no active personal budget/i, 'errors.noBudget'],
  [/duplicate key value/i, 'errors.duplicateName'],
];

// Long digit runs could be an ID number, a card number or a code: keep them out of the console
const scrub = (text: string) => text.replace(/\d{4,}/g, '[digits]');

/**
 * The sentence to show for an error a service or the import server threw: ours for known
 * messages, else the screen's own fallback. The original message is logged, with long digit
 * runs masked.
 */
export function errorMessage(err: unknown, t: (key: string) => string, fallbackKey: string): string {
  const message = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  if (message) console.error('Shown as a translated error:', scrub(message));
  const known = KNOWN.find(([pattern]) => pattern.test(message));
  return t(known ? known[1] : fallbackKey);
}
