/**
 * Rules for checking-account (bank) imports. Pure functions — no I/O.
 */

import crypto from 'crypto';

/** israeli-bank-scrapers company ids that are bank (checking) accounts rather than credit cards */
export const BANK_PROVIDERS = new Set([
  'discount', 'hapoalim', 'leumi', 'mizrahi', 'otsarHahayal', 'mercantile', 'beinleumi',
  'massad', 'yahav', 'union', 'beyahadBishvilha', 'pagi', 'oneZero',
]);

export const isBankProvider = (provider: string) => BANK_PROVIDERS.has(provider);

/**
 * Monthly credit-card bill debits (e.g. the Cal charge). They are skipped: the card's own
 * purchases are imported individually, so importing the bill would count them twice.
 * Debit-card purchases ("כרטיס דביט") are real expenses and never match.
 *
 * Real Discount descriptions seen: "כ.א.ל חיוב", "חיוב לכרטיס ויזה 7466".
 */
const CARD_BILL_PATTERNS: RegExp[] = [
  /כרטיס(י)?\s*אשראי/,
  /חיוב\s*ל?כרטיס/,
  /כרטיס\s*(ויזה|מאסטרקארד|מסטרקארד|ישראכרט|אמריקן|דיינרס)/,
  /(^|[^א-ת])כאל([^א-ת]|$)/,
  /ויזה\s*כאל/,
  /ישראכרט/,
  /אמריקן\s*אקספרס|אמקס/,
  /לאומי\s*קארד/,
  /מקס\s*איט/, // not bare "מקס": that would also match stores like מקס סטוק
  /דיינרס/,
  /\b(visa\s*cal|isracard|american\s*express|amex|diners|max\s*it)\b/i,
];

export function isCardBillPayment(description: string | null | undefined): boolean {
  if (!description) return false;
  // Banks abbreviate with punctuation ("כ.א.ל", "בע\"מ"); match on the bare letters
  const text = description.replace(/[."'״׳]/g, '');
  if (/דביט/.test(text)) return false;
  return CARD_BILL_PATTERNS.some(pattern => pattern.test(text));
}

/**
 * Stable external id for a bank transaction. Uses the bank's operation number so two identical
 * transactions on the same day (e.g. two ₪200 withdrawals) stay separate.
 */
export function makeBankExternalId(
  provider: string,
  accountNumber: string,
  tx: { identifier?: string | number; date: string; chargedAmount: number; description: string }
): string {
  const raw = `${provider}|${accountNumber}|${tx.identifier ?? ''}|${tx.date.slice(0, 10)}|${tx.chargedAmount}|${tx.description}`;
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
}
