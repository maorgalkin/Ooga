import { describe, it, expect } from 'vitest';
import { externalIdFor, stageTransactions, supersedeOlderImports, STALLED_IMPORT_MS } from '../../scraper/src/staging';
import { tryLockImport, unlockImport } from '../../scraper/src/session-manager';
import type { TransactionRow } from '../../scraper/src/supabase-push';
import { fakeDb, filterValue } from './fakeDb';

const tx = (description: string, chargedAmount: number, date = '2026-10-20T00:00:00.000Z'): TransactionRow => ({
  type: 'normal', date, processedDate: date, originalAmount: chargedAmount, originalCurrency: 'ILS',
  chargedAmount, description, status: 'completed', identifier: description,
});

const input = (transactions: TransactionRow[]) => ({
  userId: 'u1', householdId: 'h1', transactions, accountNumber: '123', connectionId: 'c1', sessionId: 's1', provider: 'discount',
});

describe('stageTransactions', () => {
  const rent = tx('שכר דירה', -4500);
  const salary = tx('משכורת', 12000);
  const coffee = tx('ארומה', -30);
  const storedKey = externalIdFor(rent, '123', 'discount');
  const deletedKey = externalIdFor(coffee, '123', 'discount');

  it('keeps new rows for review, reports stored ones, and offers deleted ones again', async () => {
    const { db, queries } = fakeDb(q => {
      if (q.table === 'transactions') return { data: [{ external_id: storedKey }] };
      if (q.table === 'import_tombstones') return { data: [{ import_key: deletedKey }] };
      return {};
    });

    const result = await stageTransactions(db, input([rent, salary, coffee, salary]));

    expect(result.staged).toBe(2);
    expect(result.duplicates.map(d => [d.description, d.reason])).toEqual([['שכר דירה', 'exists'], ['משכורת', 'exists']]);
    // Never written to transactions: only read, household-scoped
    expect(queries.filter(q => q.table === 'transactions').every(q => q.op === 'select' && filterValue(q, 'eq', 'household_id') === 'h1')).toBe(true);

    const upsert = queries.find(q => q.table === 'import_staged_rows')!;
    expect(upsert.op).toBe('upsert');
    expect(upsert.options).toEqual({ onConflict: 'session_id,import_key', ignoreDuplicates: true });
    const rows = upsert.payload as { import_key: string; tombstone_key: string | null; payload: Record<string, unknown> }[];
    expect(rows.map(r => [r.payload.description, r.tombstone_key === r.import_key])).toEqual([['משכורת', false], ['ארומה', true]]);
    expect(rows[0].payload).toMatchObject({ household_id: 'h1', external_id: rows[0].import_key, type: 'income', amount: 12000, bank_connection_id: 'c1', import_session_id: 's1', source: 'bank_import' });
  });

  it('fails the account when the rows can’t be kept, so it isn’t marked synced', async () => {
    const { db } = fakeDb(q => (q.table === 'import_staged_rows' ? { error: { message: 'boom' } } : { data: [] }));
    await expect(stageTransactions(db, input([salary]))).rejects.toThrow("Couldn't keep the fetched rows for review: boom");
  });
});

describe('supersedeOlderImports', () => {
  const now = Date.parse('2026-10-31T12:00:00Z');
  const ago = (ms: number) => new Date(now - ms).toISOString();

  it('replaces finished and stuck older imports of the account, never one still fetching', async () => {
    const { db, queries } = fakeDb(q => {
      if (q.table === 'bank_import_sessions' && q.op === 'select') {
        return { data: [
          { id: 'done', status: 'complete', started_at: ago(86_400_000) },
          { id: 'running', status: 'importing', started_at: ago(60_000) },
          { id: 'stuck', status: 'importing', started_at: ago(STALLED_IMPORT_MS + 1) },
          { id: 'raced', status: 'complete', started_at: ago(3_600_000) },
        ] };
      }
      if (q.table === 'bank_import_sessions' && q.op === 'update') {
        return { data: filterValue(q, 'eq', 'id') === 'raced' ? [] : [{ id: filterValue(q, 'eq', 'id') }] };
      }
      return {};
    });

    expect(await supersedeOlderImports(db, 'u1', 'c1', 'new', now)).toBe(2);

    const lookup = queries[0];
    expect([filterValue(lookup, 'eq', 'user_id'), filterValue(lookup, 'eq', 'bank_connection_id'), filterValue(lookup, 'neq', 'id')]).toEqual(['u1', 'c1', 'new']);
    const claimed = queries.filter(q => q.op === 'update').map(q => filterValue(q, 'eq', 'id'));
    expect(claimed).toEqual(['done', 'stuck', 'raced']);
    // Emptied only once claimed: the one another window just imported is left alone
    expect(queries.filter(q => q.op === 'delete').map(q => filterValue(q, 'eq', 'session_id'))).toEqual(['done', 'stuck']);
  });
});

describe('import lock', () => {
  it('lets one import per account run at a time', () => {
    expect(tryLockImport('connection:c1')).toBe(true);
    expect(tryLockImport('connection:c1')).toBe(false);
    expect(tryLockImport('connection:c2')).toBe(true);
    unlockImport('connection:c1');
    expect(tryLockImport('connection:c1')).toBe(true);
    unlockImport('connection:c1');
    unlockImport('connection:c2');
  });
});
