import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NormalizedTx } from '../../src/services/calDirectService';

type Row = Record<string, unknown>;
const db = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  upserts: [] as { table: string; rows: Row[]; opts: unknown }[],
  inserts: [] as { table: string; rows: Row[] }[],
  upsertError: null as { code: string; message: string } | null,
}));

function query(table: string) {
  const chain: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'in', 'update']) chain[method] = () => chain;
  chain.then = (resolve: (v: { data: Row[]; error: null }) => unknown) => resolve({ data: db.tables[table] ?? [], error: null });
  chain.upsert = (rows: Row[], opts: unknown) => {
    db.upserts.push({ table, rows, opts });
    return Promise.resolve({ error: db.upsertError });
  };
  chain.insert = (rows: Row[] | Row) => {
    db.inserts.push({ table, rows: Array.isArray(rows) ? rows : [rows] });
    return Promise.resolve({ error: null });
  };
  return chain;
}

vi.mock('../../src/lib/supabase', () => ({ supabase: { from: (table: string) => query(table) } }));

import { pushToSupabase } from '../../src/services/calDirectService';

const tx = (key: string, legacy = `legacy-${key}`): NormalizedTx => ({
  date: '2026-10-20', description: `Shop ${key}`, amount: 50, type: 'expense', category: 'Uncategorized',
  original_amount: null, original_currency: null, processed_date: null, installment_number: null, installment_total: null,
  memo: null, bank_card_last4: '7466', dedupe_hash: key, status: 'completed',
  _cardUniqueId: 'card-1', _chargeCurrency: 'ILS', _legacyHash: legacy, _linkKey: `link-${key}`,
});

describe('pushToSupabase', () => {
  beforeEach(() => {
    db.tables = {};
    db.upserts = [];
    db.inserts = [];
    db.upsertError = null;
  });

  it('puts new rows and rows deleted earlier in the holding area, not in transactions', async () => {
    db.tables.transactions = [{ id: 'stored', dedupe_hash: 'k-old', status: 'completed', amount: 50, original_amount: null, original_currency: null }];
    db.tables.import_tombstones = [{ import_key: 'legacy-k2' }];
    const result = await pushToSupabase([tx('k1'), tx('k2'), tx('k-old')], 'u1', 'h1', 'conn', 'session-1', 'ILS');

    expect(result).toMatchObject({ mode: 'staged', imported: 0, staged: 2, skipped: 1 });
    expect(db.inserts).toEqual([]);
    const [{ table, rows, opts }] = db.upserts;
    expect(table).toBe('import_staged_rows');
    expect(opts).toEqual({ onConflict: 'session_id,import_key', ignoreDuplicates: true });
    expect(rows.map((r) => [r.import_key, r.tombstone_key])).toEqual([['k1', null], ['k2', 'legacy-k2']]);
    expect(rows[0]).toMatchObject({ household_id: 'h1', session_id: 'session-1' });
    expect(rows[0].payload).toMatchObject({ dedupe_hash: 'k1', household_id: 'h1', bank_connection_id: 'conn', import_session_id: 'session-1' });
    // The match fields come along so Import can plan the row again; other internals stay out
    expect(rows[0].payload).toMatchObject({ _linkKey: 'link-k1', _legacyHash: 'legacy-k1', _chargeCurrency: 'ILS' });
    expect(rows[0].payload).not.toHaveProperty('_cardUniqueId');
    // The deleted row is in the list now, so it isn't reported as skipped
    expect(result.duplicates.map((d) => d.reason)).toEqual(['exists']);
  });

  it('writes rows straight into transactions when the holding area does not exist yet', async () => {
    db.upsertError = { code: 'PGRST205', message: 'Could not find the table' };
    const result = await pushToSupabase([tx('k1')], 'u1', 'h1', 'conn', 'session-1', 'ILS');
    expect(result).toMatchObject({ mode: 'live', imported: 1, staged: 0 });
    expect(db.inserts[0].table).toBe('transactions');
  });

  it('stops on any other holding-area error instead of writing rows behind the review', async () => {
    db.upsertError = { code: '42501', message: 'permission denied' };
    await expect(pushToSupabase([tx('k1')], 'u1', 'h1', 'conn', 'session-1', 'ILS')).rejects.toThrow('permission denied');
    expect(db.inserts).toEqual([]);
  });
});
