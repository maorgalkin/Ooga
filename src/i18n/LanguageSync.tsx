import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { readPreferences, savePreferences } from '../services/preferencesService';
import { applyLanguage, browserLanguage } from '.';

/** Applies the signed-in account's language, so a choice made on one device shows on all of them. */
export function LanguageSync() {
  const { user } = useAuth();
  const saved = readPreferences(user).language;
  const userId = user?.id;

  useEffect(() => {
    if (saved) {
      applyLanguage(saved);
      return;
    }
    if (!userId) return;
    // First sign-in after picking a language signed out: keep that choice on the account.
    // Best effort: if it fails, this device still shows the language and the next sign-in retries.
    // English is the default, so it's never written: the account stays unset until someone picks another language.
    const chosen = browserLanguage();
    if (chosen && chosen !== 'en') savePreferences({ language: chosen }).catch(() => {});
  }, [saved, userId]);

  return null;
}
