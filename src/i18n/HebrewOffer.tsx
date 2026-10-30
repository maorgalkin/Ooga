import { useState } from 'react';
import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { readPreferences, savePreferences } from '../services/preferencesService';
import { applyLanguage, browserLanguage, browserPrefersHebrew } from '.';

/**
 * Offers Hebrew, once, to people whose browser prefers it and who haven't chosen a language on
 * this browser or their account. English stays the default; choosing either answer records it,
 * so the offer doesn't come back.
 */
export function HebrewOffer() {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  // Always in Hebrew: it's for Hebrew readers, whatever the page is showing
  const t = i18n.getFixedT('he');
  const [answered, setAnswered] = useState(false);

  const chosen = browserLanguage() ?? readPreferences(user).language;
  if (answered || chosen || i18n.language === 'he' || !browserPrefersHebrew()) return null;

  const accept = () => {
    setAnswered(true);
    applyLanguage('he');
    if (user) savePreferences({ language: 'he' }).catch((e) => console.error('Saving language failed:', e instanceof Error ? e.message : e));
  };
  const decline = () => {
    setAnswered(true);
    // Remembered on this browser only: English is the default, so the account isn't written
    applyLanguage('en');
  };

  return (
    <div
      role="region"
      aria-label={t('language.offer.label')}
      dir="rtl"
      lang="he"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-md flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800 sm:bottom-6"
    >
      <Languages className="h-5 w-5 shrink-0 text-purple-600 dark:text-purple-400" aria-hidden />
      <p className="flex-1 text-sm text-gray-800 dark:text-gray-100">{t('language.offer.body')}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={decline}
          className="min-h-[38px] rounded-lg px-3 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          {t('language.offer.decline')}
        </button>
        <button
          type="button"
          onClick={accept}
          className="min-h-[38px] rounded-lg bg-purple-600 px-3 text-sm font-medium text-white hover:bg-purple-700"
        >
          {t('language.offer.accept')}
        </button>
      </div>
    </div>
  );
}
