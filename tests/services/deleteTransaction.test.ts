import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as SupabaseService from '../../src/services/supabaseDataService';
import { supabase } from '../../src/lib/supabase';

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } } })) },
  },
}));

type Row = Record<string, unknown> | null;

/** Mocks the three calls deleteTransaction makes: read the row, record the tombstone, delete */
function mockTables(row: Row, tombstoneError: { message: string } | null = null) {
  const upsert = vi.fn(async () => ({ error: tombstoneError }));
  const deleteEq = vi.fn(async () => ({ error: null }));
  vi.mocked(supabase.from).mockImplementation(((table: string) => {
    if (table === 'import_tombstones') return { upsert };
    return {
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }),
      delete: () => ({ eq: deleteEq }),
    };
  }) as never);
  return { upsert, deleteEq };
}

describe('deleteTransaction', () => {
  beforeEach(() => vi.mocked(supabase.from).mockReset());

  it('remembers a deleted bank-imported row so it is not re-imported', async () => {
    const { upsert, deleteEq } = mockTables({
      household_id: 'hh-1', dedupe_hash: 'key-1', external_id: null, date: '2026-09-20', description: 'Cafe', amount: 18,
    });
    await SupabaseService.deleteTransaction('tx-1');
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ household_id: 'hh-1', import_key: 'key-1', deleted_by: 'user-1' }),
      { onConflict: 'household_id,import_key', ignoreDuplicates: true }
    );
    expect(deleteEq).toHaveBeenCalledWith('id', 'tx-1');
  });

  it('uses the server import key for Discount rows', async () => {
    const { upsert } = mockTables({ household_id: 'hh-1', dedupe_hash: null, external_id: 'ext-9', date: '2026-09-20', description: 'x', amount: 1 });
    await SupabaseService.deleteTransaction('tx-2');
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ import_key: 'ext-9' }), expect.anything());
  });

  it('records nothing for manually added rows', async () => {
    const { upsert, deleteEq } = mockTables({ household_id: 'hh-1', dedupe_hash: null, external_id: null, date: '2026-09-20', description: 'x', amount: 1 });
    await SupabaseService.deleteTransaction('tx-3');
    expect(upsert).not.toHaveBeenCalled();
    expect(deleteEq).toHaveBeenCalledWith('id', 'tx-3');
  });

  it('still deletes when the tombstone cannot be recorded', async () => {
    const { deleteEq } = mockTables(
      { household_id: 'hh-1', dedupe_hash: 'key-1', external_id: null, date: '2026-09-20', description: 'x', amount: 1 },
      { message: 'relation "import_tombstones" does not exist' }
    );
    await SupabaseService.deleteTransaction('tx-4');
    expect(deleteEq).toHaveBeenCalledWith('id', 'tx-4');
  });
});
