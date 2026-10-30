import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { readPreferences } from '../services/preferencesService';

/**
 * `t` that addresses the reader the way they asked: a key's `_female`/`_male` variant when the
 * person chose one and the variant exists, else the neutral key. Use it instead of
 * `useTranslation().t` for anything shown to a signed-in person.
 */
export function useT() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const addressAs = readPreferences(user).addressAs;

  return useCallback(
    (key: string, options?: Record<string, unknown>): string => t(key, { context: addressAs, ...options }) as string,
    [t, addressAs],
  );
}
