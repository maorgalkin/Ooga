import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { applyLanguage } from '../../../src/i18n';
import { BudgetHistory } from '../../../src/components/settings/BudgetHistory';

vi.mock('../../../src/hooks/useBudgets', () => ({
  usePersonalBudgetHistory: () => ({
    isLoading: false,
    data: [
      { id: 'b2', name: 'Family budget', version: 2, is_active: true, updated_at: '2026-10-20T10:00:00Z',
        categories: { Groceries: { monthlyLimit: 3200, isActive: true }, Kids: { monthlyLimit: 1200, isActive: true } }, global_settings: {} },
      { id: 'b1', name: 'Family budget', version: 1, is_active: false, updated_at: '2026-10-01T10:00:00Z',
        categories: { Groceries: { monthlyLimit: 3000, isActive: true } }, global_settings: {} },
    ],
  }),
  useSetActiveBudget: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeletePersonalBudget: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

describe('BudgetHistory in Hebrew', () => {
  afterEach(() => applyLanguage('en'));

  it('uses the title the Hebrew guide quotes and Hebrew for everything but the data', () => {
    applyLanguage('he');
    const { container } = render(<BudgetHistory />);
    expect(screen.getByRole('heading', { name: 'היסטוריית התקציב' })).toBeInTheDocument();
    expect(screen.getByText('(2 גרסאות)')).toBeInTheDocument();
    expect(screen.getByText('פעיל')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'הפיכה לתקציב הפעיל' })).toBeInTheDocument();
    const latin = (container.textContent?.replace(/v\d+/g, ' ').match(/[A-Za-z]{2,}/g) ?? []).filter((w) => !['Family', 'budget'].includes(w));
    expect(latin).toEqual([]);
  });
});
