import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { applyLanguage } from '../../../src/i18n';
import { BudgetOverviewTab } from '../../../src/components/budget/BudgetOverviewTab';

const budget = (id: string, isActive: boolean, version: number) => ({
  id,
  name: 'משפחת לוי',
  version,
  is_active: isActive,
  updated_at: '2026-10-01T10:00:00Z',
  global_settings: { currency: 'ILS' },
  categories: {
    מכולת: { monthlyLimit: 3200, warningThreshold: 80, isActive: true, color: '#10B981' },
    תחבורה: { monthlyLimit: 600, warningThreshold: 80, isActive: true },
  },
});

vi.mock('../../../src/hooks/useBudgets', () => {
  const mutation = () => ({ mutateAsync: vi.fn(), isPending: false });
  return {
    useActiveBudget: () => ({ data: budget('b2', true, 2), isLoading: false }),
    useCurrentMonthBudget: () => ({ data: null }),
    usePersonalBudgetHistory: () => ({ data: [budget('b2', true, 2), budget('b1', false, 1)] }),
    useSetActiveBudget: mutation,
    useDeletePersonalBudget: mutation,
  };
});
vi.mock('../../../src/hooks/useCategories', () => ({ useCategories: () => ({ data: [] }) }));
vi.mock('../../../src/context/FinanceContext', () => ({
  useFinance: () => ({
    transactions: [
      { id: 't1', description: 'שופרסל', amount: 412, category: 'מכולת', type: 'expense', date: new Date().toISOString().slice(0, 10) },
    ],
  }),
}));
vi.mock('../../../src/components/categories/EditLimitModal', () => ({ EditLimitModal: () => null }));

describe('BudgetOverviewTab in Hebrew', () => {
  afterEach(() => applyLanguage('en'));

  it('shows the overview in Hebrew with no English left', () => {
    applyLanguage('he');
    const { container } = render(<BudgetOverviewTab />);
    expect(screen.getByText('תקציב חודשי')).toBeInTheDocument();
    expect(screen.getByText('ניצול כולל')).toBeInTheDocument();
    expect(screen.getByText('ההוצאה הגדולה ביותר')).toBeInTheDocument();
    expect(screen.getByText('גרסאות קודמות')).toBeInTheDocument();
    expect(screen.getAllByText('2 קטגוריות').length).toBeGreaterThan(0);
    // Only the version tags ("v2") are Latin
    expect(container.textContent?.match(/[A-Za-z]{2,}/g) ?? []).toEqual([]);
  });
});
