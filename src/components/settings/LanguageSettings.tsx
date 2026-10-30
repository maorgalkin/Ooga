import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { LANGUAGE_NAMES, applyLanguage, isLanguage, type AddressAs, type Language } from '../../i18n';
import { readPreferences, savePreferences } from '../../services/preferencesService';

const ADDRESS_OPTIONS = ['neutral', 'female', 'male'] as const;

/** A person's own language and Hebrew form of address, saved to their account. */
export function LanguageSettings() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const saved = readPreferences(user);
  const language = isLanguage(i18n.language) ? i18n.language : 'en';
  const [addressAs, setAddressAs] = useState<AddressAs | undefined>(saved.addressAs);
  const [error, setError] = useState<string | null>(null);

  const changeLanguage = async (next: Language) => {
    setError(null);
    applyLanguage(next);
    try {
      await savePreferences({ language: next });
    } catch (e) {
      console.error('Saving language failed:', e instanceof Error ? e.message : e);
      setError(t('language.settings.saveError'));
    }
  };

  const changeAddress = async (next: (typeof ADDRESS_OPTIONS)[number]) => {
    const value = next === 'neutral' ? undefined : next;
    const previous = addressAs;
    setError(null);
    setAddressAs(value);
    try {
      await savePreferences({ addressAs: value ?? null });
    } catch (e) {
      console.error('Saving form of address failed:', e instanceof Error ? e.message : e);
      setAddressAs(previous);
      setError(t('language.addressAs.saveError'));
    }
  };

  return (
    <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white shadow-sm dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-indigo-100 p-2 dark:bg-indigo-900/30">
            <Languages className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h4 id="language-title" className="font-medium text-gray-900 dark:text-gray-100">
              {t('language.settings.title')}
            </h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('language.settings.description')}</p>
          </div>
        </div>
        <select
          aria-labelledby="language-title"
          value={language}
          onChange={(e) => changeLanguage(e.target.value as Language)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-transparent focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        >
          {(Object.keys(LANGUAGE_NAMES) as Language[]).map((code) => (
            <option key={code} value={code} lang={code}>
              {LANGUAGE_NAMES[code]}
            </option>
          ))}
        </select>
      </div>

      {language === 'he' && (
        <div className="p-4">
          <h4 id="address-title" className="font-medium text-gray-900 dark:text-gray-100">
            {t('language.addressAs.title')}
          </h4>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('language.addressAs.description')}</p>
          <div role="radiogroup" aria-labelledby="address-title" className="mt-3 inline-flex rounded-lg bg-gray-100 p-1 dark:bg-gray-900/50">
            {ADDRESS_OPTIONS.map((option) => {
              const checked = (addressAs ?? 'neutral') === option;
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  onClick={() => changeAddress(option)}
                  className={`min-h-[38px] rounded-md px-3 text-sm font-medium transition-colors ${
                    checked
                      ? 'bg-white text-indigo-700 shadow-sm dark:bg-gray-700 dark:text-indigo-200'
                      : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
                  }`}
                >
                  {t(`language.addressAs.${option}`)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="p-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
