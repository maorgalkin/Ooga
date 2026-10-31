import { useEffect, useLayoutEffect, useSyncExternalStore, type ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { readPreferences, savePreferences } from '../services/preferencesService';
import i18n, { applyLanguage, browserLanguage } from '.';

const subscribe = (onChange: () => void) => {
  i18n.on('languageChanged', onChange);
  return () => i18n.off('languageChanged', onChange);
};
const currentLanguage = () => i18n.language;

/**
 * Applies the signed-in account's language, so a choice made on one device shows on all of them.
 *
 * When the account's language differs from the one showing (signing in on a device that last
 * showed the other language), the page waits for the switch before rendering. Otherwise whatever
 * first renders in that same moment, such as the top bar after sign-in, would subscribe to
 * language changes just after the switch happened and keep the old language.
 */
export function LanguageSync({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const saved = readPreferences(user).language;
  const userId = user?.id;
  const language = useSyncExternalStore(subscribe, currentLanguage);
  const switching = !!saved && saved !== language;

  useLayoutEffect(() => {
    if (switching && saved) applyLanguage(saved);
  }, [switching, saved]);

  useEffect(() => {
    if (saved || !userId) return;
    // First sign-in after picking a language signed out: keep that choice on the account.
    // Best effort: if it fails, this device still shows the language and the next sign-in retries.
    // English is the default, so it's never written: the account stays unset until someone picks another language.
    const chosen = browserLanguage();
    if (chosen && chosen !== 'en') savePreferences({ language: chosen }).catch(() => {});
  }, [saved, userId]);

  return switching ? null : <>{children}</>;
}
