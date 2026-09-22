import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectedMonthView } from '../../src/components/dashboard/ProjectedMonthView';
import type { Transaction } from '../../src/types';
import type { PersonalBudget } from '../../src/types/budget';

vi.mock('../../src/hooks/useBudgets', () => ({
  usePendingAdjustmentsThrough: () => ({ data: [] }),
}));

const personalBudget = {
  categories: {
    Shopping: { monthlyLimit: 3000, warningThreshold: 80, isActive: true, color: '#8B5CF6' },
    Insurance: { monthlyLimit: 500, warningThreshold: 80, isActive: true },
  },
} as unknown as PersonalBudget;

const charges: Transaction[] = [
  // In-app installment plan row (real, editable)
  { id: 'r1', description: 'Laptop', date: '2026-10-01', amount: 1000, category: 'Shopping', type: 'expense',
    installment_group_id: 'g1', installment_number: 2, installment_total: 10 },
  // Projected bank installments
  { id: 'p1', description: 'Electronics store', date: '2026-10-18', amount: 1794, category: 'Shopping', type: 'expense',
    installment_number: 3, installment_total: 3, projected: true },
  { id: 'p2', description: 'Insurance', date: '2026-10-23', amount: 399.75, category: 'Insurance', type: 'expense',
    installment_number: 3, installment_total: 4, projected: true },
];

const formatCurrency = (n: number) => `₪${n.toFixed(2)}`;

describe('ProjectedMonthView', () => {
  it('shows committed, budget and free-to-spend totals', () => {
    render(
      <ProjectedMonthView
        monthDate={new Date(2026, 9, 1)}
        transactions={charges}
        personalBudget={personalBudget}
        formatCurrency={formatCurrency}
        onViewTransaction={() => {}}
      />
    );
    expect(screen.getByText('₪3193.75')).toBeInTheDocument(); // committed
    expect(screen.getByText('₪3500.00')).toBeInTheDocument(); // budget
    expect(screen.getByText('₪306.25')).toBeInTheDocument();  // free to spend
    expect(screen.getByText('after committed charges')).toBeInTheDocument();
  });

  it('tags real and expected installments, and only real rows are clickable', () => {
    const onView = vi.fn();
    render(
      <ProjectedMonthView
        monthDate={new Date(2026, 9, 1)}
        transactions={charges}
        personalBudget={personalBudget}
        formatCurrency={formatCurrency}
        onViewTransaction={onView}
      />
    );
    expect(screen.getByText('Installment 2/10')).toBeInTheDocument();
    expect(screen.getByText('Expected 3/3')).toBeInTheDocument();
    expect(screen.getByText('Expected 3/4')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Laptop'));
    expect(onView).toHaveBeenCalledWith(charges[0]);
    fireEvent.click(screen.getByText('Electronics store'));
    expect(onView).toHaveBeenCalledTimes(1);
  });
});
