import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as SupabaseService from '../../src/services/supabaseDataService';
import { supabase } from '../../src/lib/supabase';

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } } })) },
  },
}));

function mockTables(rows: Record<string, unknown>[]) {
  const txEq = vi.fn(() => ({ order: async () => ({ data: rows, error: null }) }));
  vi.mocked(supabase.from).mockImplementation(((table: string) => {
    if (table === 'household_members') {
      return { select: () => ({ eq: () => ({ single: async () => ({ data: { household_id: 'hh-1' }, error: null }) }) }) };
    }
    return { select: () => ({ eq: txEq }) };
  }) as never);
  return { txEq };
}

describe('getTransactions', () => {
  beforeEach(() => vi.mocked(supabase.from).mockReset());

  it('keeps category_id so per-category counts (merge, delete) can match on it', async () => {
    const { txEq } = mockTables([
      { id: 'tx-1', date: '2026-10-01', description: 'Shufersal', amount: '120.50', category: 'Groceries', category_id: 'cat-1', type: 'expense' },
      { id: 'tx-2', date: '2026-10-02', description: 'Old row', amount: '10', category: 'Other', category_id: null, type: 'expense' },
    ]);

    const result = await SupabaseService.getTransactions();

    expect(txEq).toHaveBeenCalledWith('household_id', 'hh-1');
    expect(result[0]).toMatchObject({ id: 'tx-1', category: 'Groceries', category_id: 'cat-1', amount: 120.5 });
    expect(result[1].category_id).toBeUndefined();
  });
});
