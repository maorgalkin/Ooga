import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { User } from '@supabase/supabase-js';

const updateUser = vi.hoisted(() => vi.fn());
vi.mock('../../src/lib/supabase', () => ({ supabase: { auth: { updateUser } } }));

import { readPreferences, savePreferences } from '../../src/services/preferencesService';

const userWith = (meta: Record<string, unknown>) => ({ id: 'u1', user_metadata: meta }) as unknown as User;

describe('preferencesService', () => {
  beforeEach(() => updateUser.mockReset().mockResolvedValue({ data: {}, error: null }));

  it('reads the language and form of address from the account, ignoring anything unknown', () => {
    expect(readPreferences(userWith({ language: 'he', address_as: 'female' }))).toEqual({ language: 'he', addressAs: 'female' });
    expect(readPreferences(userWith({ language: 'fr', address_as: 'x' }))).toEqual({ language: undefined, addressAs: undefined });
    expect(readPreferences(null)).toEqual({ language: undefined, addressAs: undefined });
  });

  it('saves only what changed, and clears the form of address with null', async () => {
    await savePreferences({ language: 'he' });
    expect(updateUser).toHaveBeenLastCalledWith({ data: { language: 'he' } });
    await savePreferences({ addressAs: null });
    expect(updateUser).toHaveBeenLastCalledWith({ data: { address_as: null } });
  });

  it('throws when the account update fails', async () => {
    updateUser.mockResolvedValue({ data: {}, error: new Error('offline') });
    await expect(savePreferences({ language: 'en' })).rejects.toThrow('offline');
  });
});
