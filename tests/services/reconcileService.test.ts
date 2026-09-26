import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reconcileImport, undoMergesForSession } from '../../src/services/reconcileService';
import { supabase } from '../../src/lib/supabase';

vi.mock('../../src/lib/supabase', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));

type Row = Record<string, unknown>;

/** A chainable query that resolves to `rows` and records its filters */
function query(rows: Row[], log: string[] = []) {
  const chain: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'in', 'gte', 'lte']) {
    chain[method] = (...args: unknown[]) => { log.push(`${method}:${JSON.stringify(args)}`); return chain; };
  }
  chain.then = (resolve: (v: { data: Row[]; error: null }) => unknown) => resolve({ data: rows, error: null });
  return chain;
}

const bankRow = (id: string, date: string, amount: number, extra: Row = {}) =>
  ({ id, date, amount, type: 'expense', description: `bank ${id}`, bank_connection_id: 'conn-cal', installment_number: null, installment_total: null, ...extra });
const entryRow = (id: string, date: string, amount: number, extra: Row = {}) =>
  ({ id, date, amount, type: 'expense', description: `entry ${id}`, paid_with_connection_id: 'conn-cal', installment_number: null, installment_total: null, ...extra });

function mockDb(bankRows: Row[], entries: Row[], entryLog: string[] = []) {
  let call = 0;
  vi.mocked(supabase.from).mockImplementation((() => (call++ === 0 ? query(bankRows) : query(entries, entryLog))) as never);
}

describe('reconcileImport', () => {
  beforeEach(() => {
    vi.mocked(supabase.from).mockReset();
    vi.mocked(supabase.rpc).mockReset();
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as never);
  });

  it('merges unambiguous matches and suggests the rest', async () => {
    mockDb(
      [bankRow('b1', '2026-09-23', 250), bankRow('b2', '2026-09-24', 99.5)],
      [entryRow('e1', '2026-09-22', 250), entryRow('e2', '2026-09-24', 98)]
    );
    const result = await reconcileImport('session-1');

    expect(supabase.rpc).toHaveBeenCalledWith('merge_bank_transaction', { p_entry_id: 'e1', p_bank_id: 'b1' });
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(result.merged.map(m => [m.entry.id, m.bank.id])).toEqual([['e1', 'b1']]);
    expect(result.suggestions.map(m => [m.entry.id, m.bank.id])).toEqual([['e2', 'b2']]);
  });

  it('only looks at entries paid with the importing accounts, around the imported dates', async () => {
    const entryLog: string[] = [];
    mockDb([bankRow('b1', '2026-09-23', 250)], [], entryLog);
    await reconcileImport('session-1');
    expect(entryLog).toContain('eq:["source","manual"]');
    expect(entryLog).toContain('in:["paid_with_connection_id",["conn-cal"]]');
    expect(entryLog).toContain('gte:["date","2026-08-14"]');
    expect(entryLog).toContain('lte:["date","2026-10-03"]');
  });

  it('turns a merge that fails into a suggestion', async () => {
    mockDb([bankRow('b1', '2026-09-23', 250)], [entryRow('e1', '2026-09-23', 250)]);
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: null, error: { message: 'function does not exist' } } as never);
    const result = await reconcileImport('session-1');
    expect(result.merged).toEqual([]);
    expect(result.suggestions.map(m => m.entry.id)).toEqual(['e1']);
  });

  it('does nothing when the import brought no rows', async () => {
    mockDb([], []);
    expect(await reconcileImport('session-1')).toEqual({ merged: [], suggestions: [] });
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });
});

describe('undoMergesForSession', () => {
  it('undoes every merge made by that import', async () => {
    const log: string[] = [];
    vi.mocked(supabase.from).mockImplementation((() => query([{ id: 'e1' }, { id: 'e2' }], log)) as never);
    vi.mocked(supabase.rpc).mockReset();
    vi.mocked(supabase.rpc).mockResolvedValue({ data: 'bank-id', error: null } as never);

    await undoMergesForSession('session-7');
    expect(log).toContain('eq:["merge_snapshot->bank_row->>import_session_id","session-7"]');
    expect(supabase.rpc).toHaveBeenCalledWith('unmerge_bank_transaction', { p_entry_id: 'e1' });
    expect(supabase.rpc).toHaveBeenCalledWith('unmerge_bank_transaction', { p_entry_id: 'e2' });
  });
});
