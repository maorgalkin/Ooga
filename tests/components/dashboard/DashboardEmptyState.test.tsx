import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DashboardEmptyState } from '../../../src/components/dashboard/DashboardEmptyState';

vi.mock('../../../src/context/FinanceContext', () => ({
  useFinance: () => ({ refreshTransactions: vi.fn() }),
}));

vi.mock('../../../src/components/BankImportModal', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div role="dialog" aria-label="Bank import">
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

const renderEmptyState = () =>
  render(
    <MemoryRouter>
      <DashboardEmptyState
        monthDate={new Date(2026, 9, 5)}
        allTransactions={[]}
        personalBudget={null}
        formatCurrency={(n) => `₪${n}`}
      />
    </MemoryRouter>
  );

describe('DashboardEmptyState', () => {
  it('opens the bank import from the Import Transactions button', () => {
    renderEmptyState();
    expect(screen.queryByRole('dialog', { name: 'Bank import' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /import transactions/i }));
    expect(screen.getByRole('dialog', { name: 'Bank import' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog', { name: 'Bank import' })).not.toBeInTheDocument();
  });
});
