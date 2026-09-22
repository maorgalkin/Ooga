import { describe, it, expect } from 'vitest';
import type { Transaction } from '../../src/types';
import type { BudgetAdjustment, PersonalBudget } from '../../src/types/budget';
import {
  getProjectedBankInstallments,
  getLastCommittedMonth,
  buildProjectedBudgetLimits,
} from '../../src/utils/projections';

const now = new Date(2026, 8, 22); // September 22, 2026

// Bank-imported charges as the Cal import stores them (charge n dated purchase + n−1 months)
const bank = (id: string, description: string, date: string, amount: number, n: number, total: number): Transaction => ({
  id, description, date, amount, category: 'Shopping', type: 'expense',
  installment_number: n, installment_total: total,
});

describe('getProjectedBankInstallments', () => {
  it('continues a series from its latest imported charge into future months', () => {
    const projected = getProjectedBankInstallments([
      bank('a1', 'Electronics store', '2026-08-18', 1796, 1, 3),
      bank('a2', 'Electronics store', '2026-09-18', 1794, 2, 3),
    ], now);
    expect(projected).toHaveLength(1);
    expect(projected[0]).toMatchObject({
      description: 'Electronics store', date: '2026-10-18', amount: 1794,
      installment_number: 3, installment_total: 3, projected: true,
    });
  });

  it('projects nothing for a completed series', () => {
    expect(getProjectedBankInstallments([
      bank('b1', 'Furniture store', '2026-07-17', 2470.66, 1, 3),
      bank('b2', 'Furniture store', '2026-08-17', 2470.67, 2, 3),
      bank('b3', 'Furniture store', '2026-09-17', 2470.67, 3, 3),
    ], now)).toEqual([]);
  });

  it('skips charges that would fall in the current month and keeps the later ones', () => {
    const projected = getProjectedBankInstallments([
      bank('c1', 'Insurance', '2026-08-23', 399.75, 1, 4),
    ], now);
    // 2/4 would be 2026-09-23 (current month, left to the next import)
    expect(projected.map(t => [t.date, t.installment_number])).toEqual([
      ['2026-10-23', 3],
      ['2026-11-23', 4],
    ]);
  });

  it('keeps separate series for the same merchant apart', () => {
    const projected = getProjectedBankInstallments([
      bank('d1', 'Electronics store', '2026-09-05', 500, 1, 2),  // bought in September
      bank('d2', 'Electronics store', '2026-09-18', 1794, 2, 3), // bought in August
    ], now);
    expect(projected.map(t => [t.date, t.amount, t.installment_total])).toEqual([
      ['2026-10-05', 500, 2],
      ['2026-10-18', 1794, 3],
    ]);
  });

  it('ignores in-app installment plans and regular transactions', () => {
    const inApp: Transaction = { ...bank('e1', 'Laptop', '2026-09-01', 300, 1, 10), installment_group_id: 'group-1' };
    const regular: Transaction = { id: 'e2', description: 'Coffee', date: '2026-09-20', amount: 18, category: 'Food', type: 'expense' };
    expect(getProjectedBankInstallments([inApp, regular], now)).toEqual([]);
  });
});

describe('getLastCommittedMonth', () => {
  it('returns the month of the latest committed charge', () => {
    const last = getLastCommittedMonth([
      bank('f1', 'Laptop', '2027-06-01', 300, 10, 10),
      bank('f2', 'Insurance', '2026-11-23', 399.75, 4, 4),
    ], now);
    expect(last).toEqual(new Date(2027, 5, 1));
  });

  it('returns the current month when nothing is committed beyond it', () => {
    expect(getLastCommittedMonth([bank('g1', 'Coffee', '2026-09-20', 18, 1, 2)], now)).toEqual(new Date(2026, 8, 1));
  });
});

describe('buildProjectedBudgetLimits', () => {
  const personalBudget = {
    categories: {
      Groceries: { monthlyLimit: 3000, warningThreshold: 80, isActive: true },
      Shopping: { monthlyLimit: 1000, warningThreshold: 80, isActive: true },
      Travel: { monthlyLimit: 500, warningThreshold: 80, isActive: false },
    },
  } as unknown as PersonalBudget;

  const adjustment = (category_name: string, new_limit: number, effective_month: number, created_at = '2026-09-01'): BudgetAdjustment => ({
    id: `${category_name}-${effective_month}`, user_id: 'u', household_id: 'h', category_name,
    current_limit: 0, adjustment_type: 'increase', adjustment_amount: 0, new_limit,
    effective_year: 2026, effective_month, is_applied: false, created_at,
  });

  it('uses active categories only', () => {
    expect(buildProjectedBudgetLimits(personalBudget, [], new Date(2026, 9, 1))).toEqual({ Groceries: 3000, Shopping: 1000 });
  });

  it('applies scheduled adjustments effective on or before the month, in order', () => {
    const limits = buildProjectedBudgetLimits(personalBudget, [
      adjustment('Shopping', 1500, 10),
      adjustment('Shopping', 2000, 11),
      adjustment('Groceries', 2500, 12), // after the viewed month
    ], new Date(2026, 10, 1)); // November
    expect(limits).toEqual({ Groceries: 3000, Shopping: 2000 });
  });
});
