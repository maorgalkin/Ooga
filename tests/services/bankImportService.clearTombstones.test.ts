import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearTombstones } from '../../src/services/bankImportService';
import { supabase } from '../../src/lib/supabase';

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  },
}));

describe('clearTombstones', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('removes tombstones for the current household and selected import keys', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    const deleteFn = vi.fn(async () => ({ error: null }));
    vi.mocked(supabase.from).mockImplementation(((table: string) => {
      if (table === 'household_members') {
        return {
          select: () => ({
            eq: () => ({
              limit: () => ({ maybeSingle: async () => ({ data: { household_id: 'hh-1' }, error: null }) }),
            }),
          }),
        } as never;
      }
      if (table === 'import_tombstones') {
        return {
          delete: () => ({
            eq: () => ({
              in: deleteFn,
            }),
          }),
        } as never;
      }
      throw new Error(`Unexpected table: ${table}`);
    }) as never);

    await clearTombstones(['hash-1', 'hash-2']);

    expect(deleteFn).toHaveBeenCalledWith('import_key', ['hash-1', 'hash-2']);
  });

  it('throws when the user has no household', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    vi.mocked(supabase.from).mockImplementation(((table: string) => {
      if (table === 'household_members') {
        return {
          select: () => ({
            eq: () => ({
              limit: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
            }),
          }),
        } as never;
      }
      throw new Error(`Unexpected table: ${table}`);
    }) as never);

    await expect(clearTombstones(['hash-1'])).rejects.toThrow('User is not part of a household');
  });
});
