import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExistingImportRow, NormalizedTx } from '../../src/services/calDirectService';

const updates = vi.hoisted(() => [] as { values: Record<string, unknown>; id: string }[]);
vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: () => ({
      update: (values: Record<string, unknown>) => ({
        eq: (_col: string, id: string) => {
          updates.push({ values, id });
          return Promise.resolve({ error: null });
        },
      }),
    }),
  },
}));

import { applyBilledUpdates } from '../../src/services/calDirectService';

const billed: NormalizedTx = {
  date: '2026-09-22', description: 'Streaming service', amount: 18.14, type: 'expense', category: 'Uncategorized',
  original_amount: 5.99, original_currency: 'USD', processed_date: '2026-10-02', installment_number: null, installment_total: null,
  memo: 'Bank memo', bank_card_last4: '7466', dedupe_hash: 'billed-key', status: 'completed',
  _cardUniqueId: 'card-1', _chargeCurrency: 'ILS', _legacyHash: 'legacy', _linkKey: 'link',
};

describe('applyBilledUpdates', () => {
  beforeEach(() => {
    updates.length = 0;
  });

  it('moves a stored bank row to its billed amount, key and memo', async () => {
    await applyBilledUpdates([{ id: 'row-1', tx: billed }]);
    expect(updates).toEqual([{
      id: 'row-1',
      values: { amount: 18.14, original_amount: 5.99, original_currency: 'USD', processed_date: '2026-10-02', status: 'completed', dedupe_hash: 'billed-key', memo: 'Bank memo' },
    }]);
  });

  it("keeps a merged entry's own memo and brings the merge's record of the bank row up to date", async () => {
    const entry: ExistingImportRow = {
      id: 'entry-1', dedupe_hash: 'pending-key', status: 'pending', amount: 18.5, original_amount: 5.99, original_currency: 'USD',
      memo: 'Family plan | Bank: Streaming service',
      merge_snapshot: { entry: { description: 'Netflix for the kids' }, bank_row: { id: 'bank-1', dedupe_hash: 'pending-key', amount: 18.5, status: 'pending', description: 'Streaming service' } },
    };
    await applyBilledUpdates([{ id: 'entry-1', tx: billed }], [entry]);

    const [{ values }] = updates;
    expect(values).not.toHaveProperty('memo');
    expect(values).toMatchObject({ amount: 18.14, status: 'completed', dedupe_hash: 'billed-key' });
    // Undoing the merge restores the billed charge, not the pending one it replaced
    expect(values.merge_snapshot).toEqual({
      entry: { description: 'Netflix for the kids' },
      bank_row: {
        id: 'bank-1', description: 'Streaming service', amount: 18.14, status: 'completed', dedupe_hash: 'billed-key',
        original_amount: 5.99, original_currency: 'USD', processed_date: '2026-10-02', memo: 'Bank memo',
      },
    });
  });
});
