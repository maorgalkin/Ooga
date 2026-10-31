import { describe, it, expect, vi, beforeEach } from 'vitest';

const calls = vi.hoisted(() => ({ upsert: vi.fn(), select: vi.fn() }));
vi.mock('../../src/lib/supabase', () => {
  const from = (table: string) => {
    if (table === 'household_members') {
      const chain = { select: () => chain, eq: () => chain, limit: () => chain, maybeSingle: async () => ({ data: { household_id: 'h1' }, error: null }) };
      return chain;
    }
    // user_alert_views
    return {
      upsert: (rows: unknown, opts: unknown) => { calls.upsert(rows, opts); return Promise.resolve({ error: null }); },
      select: () => ({ eq: (col: string, val: string) => { calls.select(col, val); return Promise.resolve({ data: [{ alert_id: '2026-10:over:Kids' }], error: null }); } }),
    };
  };
  return { supabase: { from } };
});

import { getSeenAlertKeys, markAlertsSeen } from '../../src/services/userAlertViewService';

describe('userAlertViewService', () => {
  beforeEach(() => {
    calls.upsert.mockReset();
    calls.select.mockReset();
  });

  it("reads only this person's seen alerts", async () => {
    expect(await getSeenAlertKeys('u1')).toEqual(new Set(['2026-10:over:Kids']));
    expect(calls.select).toHaveBeenCalledWith('user_id', 'u1');
  });

  it("saves seen alerts under the person's household, ignoring ones already saved", async () => {
    await markAlertsSeen('u1', ['2026-10:near:Fun']);
    expect(calls.upsert).toHaveBeenCalledWith(
      [{ user_id: 'u1', alert_id: '2026-10:near:Fun', household_id: 'h1' }],
      { onConflict: 'user_id,alert_id', ignoreDuplicates: true },
    );
  });

  it('does nothing for no alerts', async () => {
    await markAlertsSeen('u1', []);
    expect(calls.upsert).not.toHaveBeenCalled();
  });
});
