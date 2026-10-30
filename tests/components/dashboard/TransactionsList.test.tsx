import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TransactionsList } from '../../../src/components/dashboard/TransactionsList';
import type { Transaction } from '../../../src/types';

const tx: Transaction = {
  id: 'tx-1', date: '2026-10-01', description: 'Shufersal', amount: 120, category: 'Groceries', type: 'expense',
};

describe('TransactionsList', () => {
  it('names the edit button for screen readers', () => {
    const onEdit = vi.fn();
    render(
      <TransactionsList
        transactions={[tx]}
        familyMembers={[]}
        personalBudget={null}
        formatCurrency={(n) => `₪${n}`}
        onEditTransaction={onEdit}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit transaction' }));
    expect(onEdit).toHaveBeenCalledWith(tx);
  });
});
