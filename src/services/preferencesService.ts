import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { isLanguage, type AddressAs, type Language } from '../i18n';

export interface UserPreferences {
  language?: Language;
  addressAs?: AddressAs;
}

const isAddressAs = (value: unknown): value is AddressAs => value === 'female' || value === 'male';

/**
 * A person's display preferences. They live in the auth user's metadata, next to their name,
 * so they follow the account to every device without a table of their own.
 */
export function readPreferences(user: User | null): UserPreferences {
  const meta = user?.user_metadata ?? {};
  return {
    language: isLanguage(meta.language) ? meta.language : undefined,
    addressAs: isAddressAs(meta.address_as) ? meta.address_as : undefined,
  };
}

/** Saves display preferences to the signed-in account. `addressAs: null` clears it back to neutral. */
export async function savePreferences(prefs: { language?: Language; addressAs?: AddressAs | null }) {
  const data: Record<string, string | null> = {};
  if (prefs.language !== undefined) data.language = prefs.language;
  if (prefs.addressAs !== undefined) data.address_as = prefs.addressAs;
  const { error } = await supabase.auth.updateUser({ data });
  if (error) throw error;
}
