/**
 * Matching manual entries ("paid with" a connected account, awaiting the bank) to rows a bank
 * import just brought in.
 *
 * - Candidate: same account and income/expense type, and either
 *   - a regular purchase: bank date from 2 days before to 5 days after the entry's date, and the
 *     amount equal (exact) or within 2% (approximate — foreign-currency conversion, rounding), or
 *   - an installment-plan row: same payment n of N, same month, amount within 2% (card issuers
 *     round installments differently from the app).
 * - Merged automatically only when unambiguous: an exact (or installment) match where the bank
 *   row has exactly one candidate entry and the entry exactly one candidate bank row.
 * - Everything else with a candidate becomes a suggestion (best candidate first; each entry and
 *   bank row is used at most once).
 */

export interface MatchableRow {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number;
  type: 'income' | 'expense';
  connectionId: string | null; // bank rows: the importing account; entries: "paid with"
  installmentNumber?: number | null;
  installmentTotal?: number | null;
}

export interface MatchPair {
  entryId: string;
  bankId: string;
}

type Strength = 'exact' | 'installment' | 'approximate';

interface Candidate extends MatchPair {
  strength: Strength;
  dayDistance: number;
  amountDistance: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const dayNumber = (isoDate: string) => Math.round(Date.parse(`${isoDate.slice(0, 10)}T00:00:00Z`) / DAY_MS);
const sameMonth = (a: string, b: string) => a.slice(0, 7) === b.slice(0, 7);
const withinPercent = (a: number, b: number, pct: number) =>
  Math.abs(a - b) <= (Math.max(Math.abs(a), Math.abs(b)) * pct) / 100 + 0.005;

function candidateStrength(bank: MatchableRow, entry: MatchableRow): Strength | null {
  if (!bank.connectionId || bank.connectionId !== entry.connectionId || bank.type !== entry.type) return null;

  if (entry.installmentTotal) {
    const samePayment = bank.installmentTotal === entry.installmentTotal &&
      bank.installmentNumber === entry.installmentNumber;
    return samePayment && sameMonth(bank.date, entry.date) && withinPercent(bank.amount, entry.amount, 2)
      ? 'installment'
      : null;
  }

  const days = dayNumber(bank.date) - dayNumber(entry.date);
  if (days < -2 || days > 5) return null;
  if (Math.abs(bank.amount - entry.amount) < 0.005) return 'exact';
  return withinPercent(bank.amount, entry.amount, 2) ? 'approximate' : null;
}

const RANK: Record<Strength, number> = { exact: 0, installment: 0, approximate: 1 };

export function matchEntriesToBankRows(
  bankRows: MatchableRow[],
  entries: MatchableRow[]
): { autoMerge: MatchPair[]; suggestions: MatchPair[] } {
  const candidates: Candidate[] = [];
  for (const bank of bankRows) {
    for (const entry of entries) {
      const strength = candidateStrength(bank, entry);
      if (strength) {
        candidates.push({
          entryId: entry.id,
          bankId: bank.id,
          strength,
          dayDistance: Math.abs(dayNumber(bank.date) - dayNumber(entry.date)),
          amountDistance: Math.abs(bank.amount - entry.amount),
        });
      }
    }
  }

  const countBy = (key: 'entryId' | 'bankId') => {
    const counts = new Map<string, number>();
    candidates.forEach(c => counts.set(c[key], (counts.get(c[key]) ?? 0) + 1));
    return counts;
  };
  const perBank = countBy('bankId');
  const perEntry = countBy('entryId');

  const autoMerge = candidates
    .filter(c => c.strength !== 'approximate' && perBank.get(c.bankId) === 1 && perEntry.get(c.entryId) === 1)
    .map(({ entryId, bankId }) => ({ entryId, bankId }));

  const used = new Set(autoMerge.flatMap(p => [p.entryId, p.bankId]));
  const suggestions: MatchPair[] = [];
  [...candidates]
    .sort((a, b) => RANK[a.strength] - RANK[b.strength] || a.dayDistance - b.dayDistance || a.amountDistance - b.amountDistance)
    .forEach(c => {
      if (used.has(c.entryId) || used.has(c.bankId)) return;
      used.add(c.entryId);
      used.add(c.bankId);
      suggestions.push({ entryId: c.entryId, bankId: c.bankId });
    });

  return { autoMerge, suggestions };
}
