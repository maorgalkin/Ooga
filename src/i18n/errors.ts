/**
 * Messages that services and the import server throw on purpose, each with the sentence people
 * see instead. Services keep throwing their English messages (logs and other callers rely on
 * them); screens show `errorMessage(...)`, in the reader's language.
 */
const KNOWN: [RegExp, string][] = [
  [/import service is unreachable/i, 'errors.importUnreachable'],
  [/import session already finished/i, 'errors.importFinished'],
  [/import still fetching/i, 'errors.importStillFetching'],
  [/import session not found/i, 'errors.importNotFound'],
  [/import could not be recorded/i, 'errors.importNotRecorded'],
  [/import is taking too long/i, 'errors.importTimeout'],
  [/already being imported/i, 'errors.importAlreadyRunning'],
  [/too many sms requests|HTTP 429/i, 'errors.smsTooMany'],
  [/too many tries for this code/i, 'errors.smsCodeTooMany'],
  [/couldn't send the sms code/i, 'errors.smsSendFailed'],
  [/couldn't check the sms code/i, 'errors.smsCheckFailed'],
  [/sms code wasn't entered in time/i, 'errors.otpTimedOut'],
  [/^(user )?not authenticated$|^sign in again to import/i, 'errors.signedOut'],
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

// Long digit runs could be an ID number, a card number or a code: keep them out of the console,
// also when written in groups ("123-456-789", "4580 1234 …")
const scrub = (text: string) => text.replace(/\d(?:[\s-]?\d){3,}/g, '[digits]');

// Errors arrive as Error objects, strings, or plain objects with a message (Supabase, depending on version)
const messageOf = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && typeof (err as { message?: unknown }).message === 'string') return (err as { message: string }).message;
  return '';
};

/**
 * The sentence to show for an error a service or the import server threw: ours for known
 * messages, else the screen's own fallback. The original message is logged, with long digit
 * runs masked.
 */
export function errorMessage(err: unknown, t: (key: string) => string, fallbackKey: string): string {
  const message = messageOf(err);
  if (message) console.error('Shown as a translated error:', scrub(message));
  const known = KNOWN.find(([pattern]) => pattern.test(message));
  return t(known ? known[1] : fallbackKey);
}
