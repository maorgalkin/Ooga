import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ImportReviewStep from '../../src/components/ImportReviewStep';
import * as reconcile from '../../src/services/reconcileService';
import * as bankImport from '../../src/services/bankImportService';

vi.mock('../../src/hooks/useCategories', () => ({ useCategories: () => ({ data: [] }) }));
vi.mock('../../src/services/reconcileService', () => ({
  reconcileImport: vi.fn(),
  mergeBankIntoEntry: vi.fn(async () => {}),
  undoMerge: vi.fn(async () => {}),
  undoMergesForSession: vi.fn(async () => {}),
}));
vi.mock('../../src/services/bankImportService', () => ({
  fetchImportedTransactions: vi.fn(),
  deleteTransactions: vi.fn(async () => {}),
  updateTransactionCategory: vi.fn(async () => {}),
}));

const summary = (id: string, description: string, date: string, amount: number) =>
  ({ id, description, date, amount, type: 'expense' as const });
const reviewRow = (id: string, description: string) => ({
  id, date: '2026-09-24', description, amount: 40, type: 'expense' as const, category: 'Uncategorized', category_id: null,
  original_amount: null, original_currency: null, installment_number: null, installment_total: null, memo: null,
  bank_connection_id: 'conn-cal', bank_card_last4: '7466',
});

const merged = { entry: summary('e1', 'Weekly groceries', '2026-09-22', 250), bank: summary('b1', 'שופרסל דיל', '2026-09-23', 250) };
const suggestion = { entry: summary('e2', 'Lunch', '2026-09-24', 98), bank: summary('b2', 'CAFE LANDWER', '2026-09-24', 99.5) };

describe('ImportReviewStep matching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(reconcile.reconcileImport).mockResolvedValue({ merged: [merged], suggestions: [suggestion] });
    vi.mocked(bankImport.fetchImportedTransactions).mockResolvedValue([reviewRow('b2', 'CAFE LANDWER'), reviewRow('b3', 'Bookshop')]);
  });

  const renderStep = (onCancel = vi.fn()) =>
    render(<ImportReviewStep dbSessionId="s1" result={{ imported: 3, skipped: 0 }} onDone={vi.fn()} onCancel={onCancel} />);

  it('shows merged entries and possible duplicates', async () => {
    renderStep();
    expect(await screen.findByText('Matched with your entries (1)')).toBeInTheDocument();
    expect(screen.getByText('Possible duplicates (1)')).toBeInTheDocument();
    expect(screen.getByText(/Weekly groceries/)).toBeInTheDocument();
    expect(screen.getByText('· 1 matched with your entries')).toBeInTheDocument();
  });

  it('undoes a merge and reloads the rows', async () => {
    renderStep();
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(reconcile.undoMerge).toHaveBeenCalledWith('e1'));
    await waitFor(() => expect(screen.queryByText('Matched with your entries (1)')).toBeNull());
    expect(bankImport.fetchImportedTransactions).toHaveBeenCalledTimes(2);
  });

  it('merges a suggestion into the entry', async () => {
    renderStep();
    fireEvent.click(await screen.findByRole('button', { name: 'Merge' }));
    await waitFor(() => expect(reconcile.mergeBankIntoEntry).toHaveBeenCalledWith('e2', 'b2'));
    expect(await screen.findByText('Matched with your entries (2)')).toBeInTheDocument();
    expect(screen.queryByText(/Possible duplicates/)).toBeNull();
  });

  it('keeps both without touching the data', async () => {
    renderStep();
    fireEvent.click(await screen.findByRole('button', { name: 'Keep both' }));
    expect(screen.queryByText(/Possible duplicates/)).toBeNull();
    expect(reconcile.mergeBankIntoEntry).not.toHaveBeenCalled();
  });

  it('cancelling the import undoes its merges before removing its rows', async () => {
    const onCancel = vi.fn();
    renderStep(onCancel);
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel Import' }));
    await waitFor(() => expect(onCancel).toHaveBeenCalled());
    expect(reconcile.undoMergesForSession).toHaveBeenCalledWith('s1');
    expect(bankImport.deleteTransactions).toHaveBeenCalledWith(['b2', 'b3']);
    const undoOrder = vi.mocked(reconcile.undoMergesForSession).mock.invocationCallOrder[0];
    const deleteOrder = vi.mocked(bankImport.deleteTransactions).mock.invocationCallOrder[0];
    expect(undoOrder).toBeLessThan(deleteOrder);
  });
});
