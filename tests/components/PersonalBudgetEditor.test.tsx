import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PersonalBudgetEditor } from '../../src/components/PersonalBudgetEditor';
import { applyLanguage } from '../../src/i18n';

vi.mock('../../src/hooks/useBudgets', () => {
  const mutation = () => ({ mutateAsync: vi.fn(), isPending: false });
  return {
    useActiveBudget: () => ({ data: null, isLoading: false }),
    usePersonalBudgetHistory: () => ({ data: [], isLoading: false }),
    useCreatePersonalBudget: mutation,
    useUpdatePersonalBudget: mutation,
    useSetActiveBudget: mutation,
    useDeletePersonalBudget: mutation,
    useResetAllBudgets: mutation,
  };
});

vi.mock('../../src/context/FinanceContext', () => ({
  useFinance: () => ({ transactions: [], familyMembers: [] }),
}));

describe('PersonalBudgetEditor', () => {
  // Regression: formatCurrency read an undefined `showRoundedAmounts`, so the editor
  // threw a ReferenceError as soon as it rendered an amount (creating a first budget).
  it('renders category limits and the total when creating a first budget', () => {
    render(<PersonalBudgetEditor autoCreate />);

    expect(screen.getByText('Total monthly budget:')).toBeInTheDocument();
    // Default categories: 1500 + 600 + 400 + 1000 + 300 = 3800, in ILS, rounded by default
    expect(screen.getByText('₪3,800')).toBeInTheDocument();
    expect(screen.getByText('₪1,500')).toBeInTheDocument();
  });
});

describe('PersonalBudgetEditor and the default categories', () => {
  const DEFAULTS_EN = ['Groceries', 'Transportation', 'Entertainment', 'Bills & Utilities', 'Home & Garden'];
  // The names the Hebrew guide promises (guide.he.json, chapter "budget")
  const DEFAULTS_HE = ['מכולת', 'תחבורה', 'בילויים', 'חשבונות', 'בית וגינה'];

  it('starts an English budget with the English defaults, unchanged', () => {
    render(<PersonalBudgetEditor autoCreate />);
    for (const name of DEFAULTS_EN) expect(screen.getByRole('heading', { name })).toBeInTheDocument();
    expect(screen.getByDisplayValue('My Budget')).toBeInTheDocument();
  });

  it('starts a Hebrew budget with Hebrew defaults, and the labels the guide quotes', () => {
    applyLanguage('he');
    const { container } = render(<PersonalBudgetEditor autoCreate />);
    for (const name of DEFAULTS_HE) expect(screen.getByRole('heading', { name })).toBeInTheDocument();
    expect(screen.getByDisplayValue('התקציב שלי')).toBeInTheDocument();
    expect(screen.getByText('הוספת קטגוריה')).toBeInTheDocument();
    expect(screen.getByText('שמירת התקציב')).toBeInTheDocument();
    expect(container.textContent?.match(/[A-Za-z]{2,}/g) ?? []).toEqual([]);
    applyLanguage('en');
  });
});
