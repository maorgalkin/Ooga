import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HouseholdMemberExpenses } from '../../../src/components/analytics/HouseholdMemberExpenses';

const today = new Date();
const isoToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

vi.mock('../../../src/context/FinanceContext', () => ({
  useFinance: () => ({
    transactions: [
      { id: 'tx-1', date: isoToday, description: 'Rent', amount: 1200, category: 'Rent', type: 'expense', familyMember: 'm-1' },
    ],
    familyMembers: [{ id: 'm-1', name: 'Dana', color: '#8B5CF6' }],
  }),
}));

describe('HouseholdMemberExpenses', () => {
  it('formats amounts with the budget currency instead of prefixing the code', () => {
    render(<HouseholdMemberExpenses selectedRange="mtd" globalSettings={{ currency: 'ILS', showRoundedAmounts: true }} />);

    expect(screen.getAllByText('₪1,200').length).toBeGreaterThan(0);
    expect(screen.queryByText(/ILS/)).not.toBeInTheDocument();
  });
});
