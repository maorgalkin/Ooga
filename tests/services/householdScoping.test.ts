import { describe, it, expect, vi, beforeEach } from 'vitest';

// Records every .or() filter, per table; every query resolves to rows that suit its table
const calls = vi.hoisted(() => ({ or: [] as { table: string; filter: string }[] }));
vi.mock('../../src/lib/supabase', () => {
  const chainFor = (table: string) => {
    const result =
      table === 'household_members' ? { data: { household_id: 'h-now' }, error: null }
      : table === 'categories' ? { data: [{ id: 'cat-1', household_id: 'h-now' }], error: null }
      : { data: [], error: null };
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'is', 'order', 'limit', 'insert', 'single']) chain[m] = () => chain;
    chain.or = (filter: string) => { calls.or.push({ table, filter }); return chain; };
    chain.maybeSingle = async () => result;
    chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(
      table === 'transactions' ? { data: { id: 't1', date: '2026-10-01', amount: 1, type: 'expense', category: 'Food' }, error: null } : result,
    ).then(resolve);
    return chain;
  };
  return {
    supabase: {
      from: (table: string) => chainFor(table),
      auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    },
  };
});

import { listConnections } from '../../src/services/bankImportService';
import { addTransaction } from '../../src/services/supabaseDataService';

describe('household scoping', () => {
  beforeEach(() => {
    calls.or = [];
  });

  it('lists the household’s connected accounts and the person’s own unshared ones, not ones left in another household', async () => {
    await listConnections();
    expect(calls.or).toEqual([
      { table: 'bank_connections', filter: 'household_id.eq.h-now,and(household_id.is.null,user_id.eq.u1)' },
    ]);
  });

  it('finds a category within the household (or the person’s own from before households)', async () => {
    await addTransaction({ date: '2026-10-01', description: 'x', amount: 1, category: 'Food', type: 'expense' } as never).catch(() => {});
    expect(calls.or).toContainEqual({ table: 'categories', filter: 'household_id.eq.h-now,and(household_id.is.null,user_id.eq.u1)' });
  });
});
