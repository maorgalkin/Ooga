import { describe, it, expect, vi, beforeEach } from 'vitest';

type Row = Record<string, unknown>;
const db = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  log: [] as string[],
  rpc: vi.fn(),
}));

/** A chainable query on `table` that records what it was asked and resolves to that table's rows */
function query(table: string) {
  const chain: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'in', 'is', 'order', 'update', 'delete']) {
    chain[method] = (...args: unknown[]) => { db.log.push(`${table}.${method}:${JSON.stringify(args)}`); return chain; };
  }
  chain.then = (resolve: (v: { data: Row[]; error: null }) => unknown) => resolve({ data: db.tables[table] ?? [], error: null });
  return chain;
}

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: (table: string) => query(table),
    rpc: db.rpc,
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
  },
}));

import { commitImport, discardImport, fetchStagedRows, listUnfinishedImports } from '../../src/services/bankImportService';

const payload = (date: string, description: string, amount: number) =>
  ({ date, description, amount, type: 'expense', category: 'Uncategorized', category_id: null, bank_connection_id: 'conn', bank_card_last4: '7466' });

describe('the import holding area', () => {
  beforeEach(() => {
    db.tables = {};
    db.log = [];
    db.rpc.mockReset();
  });

  it('reads waiting rows newest first, flagging the ones deleted earlier with when', async () => {
    db.tables.import_staged_rows = [
      { id: 's1', import_key: 'k1', tombstone_key: null, payload: payload('2026-10-01', 'Shufersal', 120) },
      { id: 's2', import_key: 'k2', tombstone_key: 'legacy-k2', payload: payload('2026-10-20', 'Aroma', 40) },
    ];
    db.tables.import_tombstones = [{ import_key: 'legacy-k2', deleted_at: '2026-10-05T10:00:00Z' }];
    const rows = await fetchStagedRows('session-1');
    expect(rows.map((r) => [r.id, r.description, r.deletedEarlier])).toEqual([
      ['s2', 'Aroma', { at: '2026-10-05T10:00:00Z' }],
      ['s1', 'Shufersal', undefined],
    ]);
    expect(db.log).toContain('import_staged_rows.eq:["session_id","session-1"]');
    expect(db.log).toContain('import_tombstones.in:["import_key",["legacy-k2"]]');
  });

  it('imports the ticked rows in one call and reports each outcome', async () => {
    db.rpc.mockResolvedValue({
      data: [
        { staged_id: 's1', transaction_id: 't1', outcome: 'imported' },
        { staged_id: 's2', transaction_id: null, outcome: 'already_imported' },
      ],
      error: null,
    });
    const picked = [{ id: 's1', category: 'Groceries', category_id: 'c1' }, { id: 's2' }];
    const outcomes = await commitImport('session-1', picked);
    expect(db.rpc).toHaveBeenCalledWith('commit_import', { p_session_id: 'session-1', p_selected: picked });
    expect(outcomes).toEqual([
      { stagedId: 's1', transactionId: 't1', outcome: 'imported' },
      { stagedId: 's2', transactionId: null, outcome: 'already_imported' },
    ]);
  });

  it('passes on what the database says when the import cannot be finished', async () => {
    db.rpc.mockResolvedValue({ data: null, error: { message: 'import session already finished' } });
    await expect(commitImport('session-1', [])).rejects.toThrow('import session already finished');
  });

  it('cancelling empties the holding area and marks the import cancelled', async () => {
    await discardImport('session-1');
    expect(db.log).toContain('import_staged_rows.delete:[]');
    expect(db.log).toContain('import_staged_rows.eq:["session_id","session-1"]');
    expect(db.log.find((l) => l.startsWith('bank_import_sessions.update'))).toContain('"status":"cancelled"');
    expect(db.log).toContain('bank_import_sessions.eq:["id","session-1"]');
  });

  it('lists only my postponed imports that still have rows waiting', async () => {
    db.tables.bank_import_sessions = [
      { id: 'a', started_at: '2026-10-30T08:00:00Z', bank_connections: { display_name: 'Visa Cal' }, import_staged_rows: [{ count: 12 }] },
      { id: 'b', started_at: '2026-10-29T08:00:00Z', bank_connections: null, import_staged_rows: [{ count: 0 }] },
    ];
    expect(await listUnfinishedImports()).toEqual([{ id: 'a', startedAt: '2026-10-30T08:00:00Z', connectionName: 'Visa Cal', rows: 12 }]);
    expect(db.log).toContain('bank_import_sessions.eq:["user_id","u1"]');
    expect(db.log).toContain('bank_import_sessions.is:["reviewed_at",null]');
  });
});
