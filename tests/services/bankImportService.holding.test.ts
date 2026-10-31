import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalizeTransaction, convertToBudgetCurrency, discardOlderUnfinished, type CalTransaction, type NormalizedTx } from '../../src/services/calDirectService';

type Row = Record<string, unknown>;
const db = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  log: [] as string[],
  rpc: vi.fn(),
}));

/** A small in-memory table: applies eq / neq / in / is filters and range, and records what it was asked */
function query(table: string) {
  const filters: ((row: Row) => boolean)[] = [];
  let op: 'select' | 'update' | 'delete' = 'select';
  let patch: Row = {};
  let range: [number, number] | null = null;
  const matching = () => (db.tables[table] ?? []).filter((row) => filters.every((f) => f(row)));
  const chain: Record<string, unknown> = {};
  const record = (method: string, args: unknown[]) => db.log.push(`${table}.${method}:${JSON.stringify(args)}`);
  chain.select = (...args: unknown[]) => { record('select', args); return chain; };
  chain.order = () => chain;
  chain.eq = (col: string, val: unknown) => { record('eq', [col, val]); filters.push((r) => r[col] === val); return chain; };
  chain.neq = (col: string, val: unknown) => { record('neq', [col, val]); filters.push((r) => r[col] !== val); return chain; };
  chain.in = (col: string, vals: unknown[]) => { record('in', [col, vals]); filters.push((r) => vals.includes(r[col])); return chain; };
  chain.is = (col: string, val: unknown) => { record('is', [col, val]); filters.push((r) => (r[col] ?? null) === val); return chain; };
  chain.range = (from: number, to: number) => { range = [from, to]; return chain; };
  chain.update = (values: Row) => { record('update', [values]); op = 'update'; patch = values; return chain; };
  chain.delete = () => { record('delete', []); op = 'delete'; return chain; };
  chain.then = (resolve: (v: { data: Row[]; error: null }) => unknown) => {
    const rows = matching();
    if (op === 'update') rows.forEach((r) => Object.assign(r, patch));
    if (op === 'delete') db.tables[table] = (db.tables[table] ?? []).filter((r) => !rows.includes(r));
    return resolve({ data: range ? rows.slice(range[0], range[1] + 1) : rows, error: null });
  };
  return chain;
}

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: (table: string) => query(table),
    rpc: db.rpc,
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
  },
}));
vi.mock('../../src/services/personalBudgetService', () => ({
  PersonalBudgetService: { getActiveBudget: async () => ({ global_settings: { currency: 'ILS' } }) },
}));
vi.mock('../../src/services/exchangeRateService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/services/exchangeRateService')>()),
  convertAmount: vi.fn(async (amount: number, _from: string, _to: string, date: string) =>
    ({ amount: Math.round(amount * 3 * 100) / 100, rate: 3, rateDate: date, source: 'ECB' })),
}));

import {
  commitImportWithReplan,
  discardImport,
  fetchStagedRows,
  listUnfinishedImports,
  reopenImport,
} from '../../src/services/bankImportService';

const payload = (date: string, description: string, amount: number) =>
  ({ date, description, amount, type: 'expense', category: 'Uncategorized', category_id: null, bank_connection_id: 'conn', bank_card_last4: '7466' });

// A $5.99 subscription: pending first, then billed at ₪18.14, under a different key
const pendingCal: CalTransaction = { merchantName: 'Streaming service', trnPurchaseDate: '2026-09-22T08:00:00', trnAmt: 5.99, trnCurrencySymbol: '$', numberOfPayments: 0 };
const billedCal: CalTransaction = { ...pendingCal, debCrdDate: '2026-10-02', amtBeforeConvAndIndex: 18.14, debCrdCurrencySymbol: '₪', numOfPayments: 0 };
const normalize = async (tx: CalTransaction, pending: boolean) => {
  const n = await normalizeTransaction(tx, 'card-1', pending, '7466');
  await convertToBudgetCurrency([n], 'ILS');
  return n;
};
/** A row as the holding area keeps it: the transaction plus its match fields */
const stagedFrom = (id: string, tx: NormalizedTx) => ({
  id, household_id: 'h1', session_id: 'session-1', import_key: tx.dedupe_hash, tombstone_key: null,
  payload: { ...Object.fromEntries(Object.entries(tx).filter(([k]) => !k.startsWith('_'))), bank_connection_id: 'conn',
    _linkKey: tx._linkKey, _legacyHash: tx._legacyHash, _chargeCurrency: tx._chargeCurrency },
});
/** A row as transactions stores it */
const storedFrom = (id: string, tx: NormalizedTx) => ({
  id, household_id: 'h1', bank_connection_id: 'conn', dedupe_hash: tx.dedupe_hash, status: tx.status, amount: tx.amount,
  original_amount: tx.original_amount, original_currency: tx.original_currency, date: tx.date, description: tx.description,
  type: tx.type, bank_card_last4: tx.bank_card_last4, installment_number: null, installment_total: null,
});

describe('the import holding area', () => {
  beforeEach(() => {
    db.tables = {};
    db.log = [];
    db.rpc.mockReset().mockImplementation(async (_fn: string, args: { p_selected: { id: string }[] }) => ({
      data: args.p_selected.map((s) => ({ staged_id: s.id, transaction_id: `t-${s.id}`, outcome: 'imported' })),
      error: null,
    }));
  });

  it('reads waiting rows newest first, flagging the ones deleted earlier with when', async () => {
    db.tables.import_staged_rows = [
      { id: 's1', household_id: 'h1', session_id: 'session-1', import_key: 'k1', tombstone_key: null, payload: payload('2026-10-01', 'Shufersal', 120) },
      { id: 's2', household_id: 'h1', session_id: 'session-1', import_key: 'k2', tombstone_key: 'legacy-k2', payload: payload('2026-10-20', 'Aroma', 40) },
    ];
    db.tables.import_tombstones = [{ household_id: 'h1', import_key: 'legacy-k2', deleted_at: '2026-10-05T10:00:00Z' }];
    const rows = await fetchStagedRows('session-1');
    expect(rows.map((r) => [r.id, r.description, r.deletedEarlier])).toEqual([
      ['s2', 'Aroma', { at: '2026-10-05T10:00:00Z' }],
      ['s1', 'Shufersal', undefined],
    ]);
    expect(db.log).toContain('import_tombstones.eq:["household_id","h1"]');
  });

  it('reads past the first thousand waiting rows', async () => {
    db.tables.import_staged_rows = Array.from({ length: 1001 }, (_, i) => ({
      id: `s${i}`, household_id: 'h1', session_id: 'session-1', import_key: `k${i}`, tombstone_key: null, payload: payload('2026-10-01', `Shop ${i}`, 1),
    }));
    expect(await fetchStagedRows('session-1')).toHaveLength(1001);
  });

  describe('Import, planned again against what is stored now', () => {
    it('updates the stored pending charge with a waiting billed one, instead of importing it again', async () => {
      const pending = await normalize(pendingCal, true);
      const billed = await normalize(billedCal, false);
      db.tables.transactions = [storedFrom('stored-p', pending)];
      db.tables.import_staged_rows = [stagedFrom('s-billed', billed)];

      const outcomes = await commitImportWithReplan('session-1', [{ id: 's-billed' }]);
      expect(outcomes).toEqual([{ stagedId: 's-billed', transactionId: null, outcome: 'updated' }]);
      expect(db.tables.transactions[0]).toMatchObject({ status: 'completed', dedupe_hash: billed.dedupe_hash });
      // The import still finishes, with nothing left to add
      expect(db.rpc).toHaveBeenCalledWith('commit_import', { p_session_id: 'session-1', p_selected: [] });
    });

    it("doesn't import a waiting pending charge once its billed version is stored", async () => {
      const pending = await normalize(pendingCal, true);
      const billed = await normalize(billedCal, false);
      db.tables.transactions = [storedFrom('stored-b', billed)];
      db.tables.import_staged_rows = [stagedFrom('s-pending', pending)];

      const outcomes = await commitImportWithReplan('session-1', [{ id: 's-pending' }]);
      expect(outcomes).toEqual([{ stagedId: 's-pending', transactionId: null, outcome: 'already_imported' }]);
      expect(db.rpc).toHaveBeenCalledWith('commit_import', { p_session_id: 'session-1', p_selected: [] });
    });

    it("doesn't let a waiting pending row overwrite a newer stored pending one", async () => {
      const waiting = await normalize({ ...pendingCal, trnCurrencySymbol: '₪', trnAmt: 100 }, true);
      const newer = await normalize({ ...pendingCal, trnCurrencySymbol: '₪', trnAmt: 120 }, true);
      db.tables.transactions = [storedFrom('stored-p', newer)];
      db.tables.import_staged_rows = [stagedFrom('s-pending', waiting)];

      const outcomes = await commitImportWithReplan('session-1', [{ id: 's-pending' }]);
      expect(outcomes).toEqual([{ stagedId: 's-pending', transactionId: null, outcome: 'already_imported' }]);
      expect(db.tables.transactions[0]).toMatchObject({ amount: 120, status: 'pending' });
      expect(db.rpc).toHaveBeenCalledWith('commit_import', { p_session_id: 'session-1', p_selected: [] });
    });

    it('reports a row stored meanwhile as already imported', async () => {
      const billed = await normalize(billedCal, false);
      db.tables.transactions = [storedFrom('stored', billed)];
      db.tables.import_staged_rows = [stagedFrom('s1', billed)];
      const outcomes = await commitImportWithReplan('session-1', [{ id: 's1', category: 'Fun', category_id: 'c1' }]);
      expect(outcomes).toEqual([{ stagedId: 's1', transactionId: null, outcome: 'already_imported' }]);
    });

    it('imports what is still new, with the chosen category, and brings back rows deleted earlier', async () => {
      const billed = await normalize(billedCal, false);
      db.tables.import_staged_rows = [{ ...stagedFrom('s1', billed), tombstone_key: billed.dedupe_hash }];
      db.tables.import_tombstones = [{ household_id: 'h1', import_key: billed.dedupe_hash }];
      const outcomes = await commitImportWithReplan('session-1', [{ id: 's1', category: 'Fun', category_id: 'c1' }]);
      expect(db.rpc).toHaveBeenCalledWith('commit_import', { p_session_id: 'session-1', p_selected: [{ id: 's1', category: 'Fun', category_id: 'c1' }] });
      expect(outcomes).toEqual([{ stagedId: 's1', transactionId: 't-s1', outcome: 'imported' }]);
    });

    it('imports only the billed version when both versions of a charge are ticked', async () => {
      const pending = await normalize(pendingCal, true);
      const billed = await normalize(billedCal, false);
      db.tables.import_staged_rows = [stagedFrom('s-pending', pending), stagedFrom('s-billed', billed)];
      const outcomes = await commitImportWithReplan('session-1', [{ id: 's-pending' }, { id: 's-billed' }]);
      expect(db.rpc).toHaveBeenCalledWith('commit_import', { p_session_id: 'session-1', p_selected: [{ id: 's-billed' }] });
      expect(outcomes).toContainEqual({ stagedId: 's-pending', transactionId: null, outcome: 'already_imported' });
    });

    it('passes on what the database says when the import cannot be finished', async () => {
      db.rpc.mockResolvedValue({ data: null, error: { message: 'import session already finished' } });
      await expect(commitImportWithReplan('session-1', [])).rejects.toThrow('import session already finished');
    });
  });

  it('cancelling claims the import first, then empties its holding area', async () => {
    db.tables.bank_import_sessions = [{ id: 'session-1', reviewed_at: null, status: 'complete' }];
    db.tables.import_staged_rows = [{ id: 's1', session_id: 'session-1' }];
    await discardImport('session-1');
    expect(db.tables.bank_import_sessions[0]).toMatchObject({ status: 'cancelled' });
    expect(db.tables.import_staged_rows).toEqual([]);
  });

  it('cancelling an import that was already finished says so and leaves it alone', async () => {
    db.tables.bank_import_sessions = [{ id: 'session-1', reviewed_at: '2026-10-31T10:00:00Z', status: 'complete' }];
    db.tables.import_staged_rows = [{ id: 's1', session_id: 'session-1' }];
    await expect(discardImport('session-1')).rejects.toThrow('import session already finished');
    expect(db.tables.import_staged_rows).toHaveLength(1);
  });

  it('lists my postponed imports with rows waiting, and ones that stopped while fetching', async () => {
    const longAgo = new Date(Date.now() - 30 * 60_000).toISOString();
    const justNow = new Date().toISOString();
    db.tables.bank_import_sessions = [
      { id: 'a', user_id: 'u1', status: 'complete', reviewed_at: null, started_at: '2026-10-30T08:00:00Z', bank_connections: { display_name: 'Visa Cal' }, import_staged_rows: [{ count: 12 }] },
      { id: 'b', user_id: 'u1', status: 'complete', reviewed_at: null, started_at: '2026-10-29T08:00:00Z', bank_connections: null, import_staged_rows: [{ count: 0 }] },
      { id: 'c', user_id: 'u1', status: 'importing', reviewed_at: null, started_at: longAgo, bank_connections: null, import_staged_rows: [{ count: 3 }] },
      { id: 'd', user_id: 'u1', status: 'importing', reviewed_at: null, started_at: justNow, bank_connections: null, import_staged_rows: [{ count: 3 }] },
    ];
    expect((await listUnfinishedImports()).map((u) => [u.id, u.rows, u.stalled])).toEqual([['a', 12, false], ['c', 3, true]]);
  });

  it('a new fetch cancels my older imports of the account, but not one that may still be fetching', async () => {
    const longAgo = new Date(Date.now() - 30 * 60_000).toISOString();
    const justNow = new Date().toISOString();
    const session = (id: string, status: string, started_at: string, extra: Row = {}) =>
      ({ id, user_id: 'u1', bank_connection_id: 'conn', status, started_at, reviewed_at: null, ...extra });
    db.tables.bank_import_sessions = [
      session('new', 'complete', justNow),
      session('fetched', 'complete', longAgo),
      session('stalled', 'importing', longAgo),
      session('running', 'importing', justNow),
      session('other-account', 'complete', longAgo, { bank_connection_id: 'other' }),
    ];
    db.tables.import_staged_rows = ['new', 'fetched', 'stalled', 'running', 'other-account'].map((id) => ({ id: `s-${id}`, session_id: id }));

    await discardOlderUnfinished('u1', 'conn', 'new');
    const status = Object.fromEntries(db.tables.bank_import_sessions.map((s) => [s.id, s.status]));
    expect(status).toEqual({ new: 'complete', fetched: 'cancelled', stalled: 'cancelled', running: 'importing', 'other-account': 'complete' });
    expect(db.tables.import_staged_rows.map((r) => r.id)).toEqual(['s-new', 's-running', 's-other-account']);
  });

  it('reopens an import that stopped while fetching, so it can be imported', async () => {
    db.tables.bank_import_sessions = [{ id: 'c', status: 'importing', reviewed_at: null }];
    await reopenImport('c');
    expect(db.tables.bank_import_sessions[0].status).toBe('complete');
  });
});
