import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ImportReviewStep from '../../src/components/ImportReviewStep';
import * as reconcile from '../../src/services/reconcileService';
import * as bankImport from '../../src/services/bankImportService';

vi.mock('../../src/hooks/useCategories', () => ({
  useCategories: () => ({ data: [{ id: 'c-food', name: 'Groceries', isActive: true }] }),
}));
vi.mock('../../src/services/reconcileService', () => ({
  reconcileImport: vi.fn(),
  previewMatches: vi.fn(),
  mergeBankIntoEntry: vi.fn(async () => {}),
  undoMerge: vi.fn(async () => {}),
  undoMergesForSession: vi.fn(async () => {}),
}));
vi.mock('../../src/services/bankImportService', () => ({
  fetchImportedTransactions: vi.fn(),
  fetchStagedRows: vi.fn(),
  commitImportWithReplan: vi.fn(),
  discardImport: vi.fn(async () => {}),
  deleteTransactions: vi.fn(async () => {}),
  updateTransactionCategory: vi.fn(async () => {}),
}));

const staged = (id: string, description: string, extra: Partial<bankImport.ReviewTransaction> = {}): bankImport.ReviewTransaction => ({
  id, date: '2026-10-20', description, amount: 40, type: 'expense', category: 'Uncategorized', category_id: null,
  original_amount: null, original_currency: null, installment_number: null, installment_total: null, memo: null,
  bank_connection_id: 'conn-cal', bank_card_last4: '7466', ...extra,
});
const summary = (id: string, description: string) => ({ id, description, date: '2026-10-20', amount: 250, type: 'expense' as const });
const willJoin = { entry: summary('e1', 'Weekly groceries'), bank: summary('s1', 'Shufersal') };

function renderStaged() {
  const props = { onDone: vi.fn(), onCancel: vi.fn(), onFinishLater: vi.fn() };
  render(<ImportReviewStep dbSessionId="session-1" mode="staged" result={{ imported: 0, skipped: 0 }} {...props} />);
  return props;
}

describe('ImportReviewStep with rows in the holding area', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(bankImport.fetchStagedRows).mockResolvedValue([
      staged('s1', 'Shufersal'),
      staged('s2', 'Aroma'),
      staged('s3', 'Paz', { deletedEarlier: { at: '2026-10-05T10:00:00Z' } }),
    ]);
    vi.mocked(reconcile.previewMatches).mockResolvedValue({ certain: [willJoin], possible: [] });
    vi.mocked(bankImport.commitImportWithReplan).mockResolvedValue([
      { stagedId: 's1', transactionId: 't1', outcome: 'imported' },
      { stagedId: 's2', transactionId: null, outcome: 'already_imported' },
      { stagedId: 's9', transactionId: null, outcome: 'updated' },
    ]);
  });

  it('offers rows deleted earlier again, unticked and tagged', async () => {
    renderStaged();
    expect(await screen.findByRole('button', { name: 'Import 2 transactions' })).toBeEnabled();
    expect(screen.getAllByText('Deleted earlier').length).toBeGreaterThan(0);
    expect(screen.getByText("Unticked rows aren't imported now. The next import offers them again.")).toBeInTheDocument();
    // Nothing merged yet: the match is only a preview
    expect(screen.getByText('Will join your entries (1)')).toBeInTheDocument();
    expect(reconcile.mergeBankIntoEntry).not.toHaveBeenCalled();
  });

  it('imports the ticked rows with their categories, joins the matched one, and reports the outcome', async () => {
    const { onDone } = renderStaged();
    await screen.findByRole('button', { name: 'Import 2 transactions' });
    // The bulk picker comes first, then each row's (desktop and phone layouts): Shufersal's is next
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'c-food' } });
    fireEvent.click(screen.getByRole('button', { name: 'Import 2 transactions' }));

    await waitFor(() => expect(onDone).toHaveBeenCalledWith({ imported: 1, alreadyImported: 1, updated: 1, notJoined: 0 }));
    expect(bankImport.commitImportWithReplan).toHaveBeenCalledWith('session-1', [
      { id: 's1', category: 'Groceries', category_id: 'c-food' },
      { id: 's2' },
    ]);
    expect(reconcile.mergeBankIntoEntry).toHaveBeenCalledWith('e1', 't1');
    expect(bankImport.deleteTransactions).not.toHaveBeenCalled();
  });

  it("doesn't join rows the person kept separate", async () => {
    renderStaged();
    fireEvent.click(await screen.findByRole('button', { name: 'Keep separate' }));
    fireEvent.click(screen.getByRole('button', { name: 'Import 2 transactions' }));
    await waitFor(() => expect(bankImport.commitImportWithReplan).toHaveBeenCalled());
    expect(reconcile.mergeBankIntoEntry).not.toHaveBeenCalled();
  });

  it('cannot import nothing', async () => {
    renderStaged();
    await screen.findByRole('button', { name: 'Import 2 transactions' });
    const [selectAll] = screen.getAllByRole('checkbox');
    fireEvent.click(selectAll); // ticks all three
    fireEvent.click(selectAll); // and clears them
    expect(screen.getByRole('button', { name: 'Import 0 transactions' })).toBeDisabled();
  });

  it('finishing later leaves the rows waiting', async () => {
    const { onFinishLater } = renderStaged();
    fireEvent.click(await screen.findByRole('button', { name: 'Finish later' }));
    expect(onFinishLater).toHaveBeenCalled();
    expect(bankImport.discardImport).not.toHaveBeenCalled();
    expect(bankImport.commitImportWithReplan).not.toHaveBeenCalled();
  });

  it('cancelling empties the holding area', async () => {
    const { onCancel } = renderStaged();
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel import' }));
    await waitFor(() => expect(onCancel).toHaveBeenCalled());
    expect(bankImport.discardImport).toHaveBeenCalledWith('session-1');
    expect(bankImport.deleteTransactions).not.toHaveBeenCalled();
  });

  it('explains when the import was already finished elsewhere', async () => {
    vi.mocked(bankImport.commitImportWithReplan).mockRejectedValue(new Error('import session already finished'));
    renderStaged();
    fireEvent.click(await screen.findByRole('button', { name: 'Import 2 transactions' }));
    expect(await screen.findByText('This import was already finished, maybe in another window.')).toBeInTheDocument();
  });
});
