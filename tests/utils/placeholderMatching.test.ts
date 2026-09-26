import { describe, it, expect } from 'vitest';
import { matchEntriesToBankRows, type MatchableRow } from '../../src/utils/placeholderMatching';

const CAL = 'conn-cal';
const DISCOUNT = 'conn-discount';

const entry = (id: string, date: string, amount: number, extra: Partial<MatchableRow> = {}): MatchableRow =>
  ({ id, date, amount, type: 'expense', connectionId: CAL, ...extra });
const bank = (id: string, date: string, amount: number, extra: Partial<MatchableRow> = {}): MatchableRow =>
  ({ id, date, amount, type: 'expense', connectionId: CAL, ...extra });

describe('matchEntriesToBankRows', () => {
  it('merges an exact, unambiguous match automatically', () => {
    const result = matchEntriesToBankRows([bank('b1', '2026-09-23', 250)], [entry('e1', '2026-09-22', 250)]);
    expect(result).toEqual({ autoMerge: [{ entryId: 'e1', bankId: 'b1' }], suggestions: [] });
  });

  it('only suggests an approximate amount (e.g. a foreign purchase converted to ₪)', () => {
    const result = matchEntriesToBankRows([bank('b1', '2026-09-22', 184.9)], [entry('e1', '2026-09-22', 182)]);
    expect(result).toEqual({ autoMerge: [], suggestions: [{ entryId: 'e1', bankId: 'b1' }] });
  });

  it('ignores the description but requires the same account and type', () => {
    expect(matchEntriesToBankRows([bank('b1', '2026-09-22', 250, { connectionId: DISCOUNT })], [entry('e1', '2026-09-22', 250)]))
      .toEqual({ autoMerge: [], suggestions: [] });
    expect(matchEntriesToBankRows([bank('b1', '2026-09-22', 250, { type: 'income' })], [entry('e1', '2026-09-22', 250)]))
      .toEqual({ autoMerge: [], suggestions: [] });
  });

  it('accepts bank dates from 2 days before to 5 days after the entry', () => {
    const entries = [entry('e1', '2026-09-10', 100)];
    const match = (date: string) => matchEntriesToBankRows([bank('b1', date, 100)], entries).autoMerge.length;
    expect(match('2026-09-08')).toBe(1);
    expect(match('2026-09-15')).toBe(1);
    expect(match('2026-09-07')).toBe(0);
    expect(match('2026-09-16')).toBe(0);
  });

  it('asks instead of guessing when two entries could match one bank row', () => {
    const result = matchEntriesToBankRows(
      [bank('b1', '2026-09-22', 40)],
      [entry('e1', '2026-09-21', 40), entry('e2', '2026-09-22', 40)]
    );
    expect(result.autoMerge).toEqual([]);
    expect(result.suggestions).toEqual([{ entryId: 'e2', bankId: 'b1' }]); // closest date first
  });

  it('pairs installment-plan rows with the card\'s installments by payment number and month', () => {
    // App plan: ₪5,384 in 3 → 1,794.68 first; Cal charges 1,796 then 1,794
    const plan = [
      entry('p1', '2026-08-18', 1794.68, { installmentNumber: 1, installmentTotal: 3 }),
      entry('p2', '2026-09-01', 1794.66, { installmentNumber: 2, installmentTotal: 3 }),
    ];
    const cal = [
      bank('c1', '2026-08-18', 1796, { installmentNumber: 1, installmentTotal: 3 }),
      bank('c2', '2026-09-18', 1794, { installmentNumber: 2, installmentTotal: 3 }),
    ];
    expect(matchEntriesToBankRows(cal, plan).autoMerge).toEqual([
      { entryId: 'p1', bankId: 'c1' },
      { entryId: 'p2', bankId: 'c2' },
    ]);
  });

  it('does not pair installments with a different payment number or month', () => {
    const plan = [entry('p2', '2026-09-01', 1794.66, { installmentNumber: 2, installmentTotal: 3 })];
    expect(matchEntriesToBankRows([bank('c3', '2026-10-18', 1794, { installmentNumber: 3, installmentTotal: 3 })], plan))
      .toEqual({ autoMerge: [], suggestions: [] });
    expect(matchEntriesToBankRows([bank('c2', '2026-10-18', 1794, { installmentNumber: 2, installmentTotal: 3 })], plan))
      .toEqual({ autoMerge: [], suggestions: [] });
  });

  it('uses each entry and bank row at most once across suggestions', () => {
    const result = matchEntriesToBankRows(
      [bank('b1', '2026-09-22', 40), bank('b2', '2026-09-22', 40)],
      [entry('e1', '2026-09-22', 40), entry('e2', '2026-09-22', 40)]
    );
    expect(result.autoMerge).toEqual([]);
    expect(result.suggestions).toHaveLength(2);
    expect(new Set(result.suggestions.map(s => s.entryId)).size).toBe(2);
    expect(new Set(result.suggestions.map(s => s.bankId)).size).toBe(2);
  });
});
