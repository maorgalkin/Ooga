import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PersonalBudgetEditor } from '../../src/components/PersonalBudgetEditor';

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

    expect(screen.getByText('Total Monthly Budget:')).toBeInTheDocument();
    // Default categories: 1500 + 600 + 400 + 1000 + 300 = 3800, in ILS, rounded by default
    expect(screen.getByText('₪3,800')).toBeInTheDocument();
    expect(screen.getByText('₪1,500')).toBeInTheDocument();
  });
});
