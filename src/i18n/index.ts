import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import he from './locales/he.json';

export const LANGUAGES = ['en', 'he'] as const;
export type Language = (typeof LANGUAGES)[number];

/** How Hebrew text addresses the reader. Unset means the neutral wording every key has. */
export type AddressAs = 'female' | 'male';

const STORAGE_KEY = 'ooga.language';

/** Each language named in its own script, so anyone can find theirs whatever is showing now. */
export const LANGUAGE_NAMES: Record<Language, string> = { en: 'English', he: 'עברית' };

export const isLanguage = (value: unknown): value is Language => LANGUAGES.includes(value as Language);

/**
 * Hebrew stays hidden until every screen is translated: without VITE_ENABLE_HEBREW=1 the app is
 * English only, whatever a person saved earlier.
 */
export const isHebrewEnabled = () => import.meta.env.VITE_ENABLE_HEBREW === '1';

function storedLanguage(): Language | undefined {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return isLanguage(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

/** The language to show: the account's choice, else this browser's last choice, else English. */
export function resolveLanguage(saved?: unknown): Language {
  if (!isHebrewEnabled()) return 'en';
  if (isLanguage(saved)) return saved;
  return storedLanguage() ?? 'en';
}

/**
 * Switches the app's language and the page direction with it. Also remembered in this browser,
 * so pages people see signed out (sign-in, About, Guide) keep it; signed-in choices are saved to
 * the account by `savePreferences` so they follow the person to other devices.
 */
export function applyLanguage(language: Language) {
  document.documentElement.lang = language;
  document.documentElement.dir = language === 'he' ? 'rtl' : 'ltr';
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Private mode or blocked storage: the choice lasts for this visit only
  }
  if (i18n.language !== language) void i18n.changeLanguage(language);
}

/** True while the page is right-to-left, for the few things CSS can't mirror (drag offsets, slide-ins). */
export const isRtl = () => typeof document !== 'undefined' && document.documentElement.dir === 'rtl';

/** The language this browser chose while signed out, if any, for carrying over to the account. */
export const browserLanguage = storedLanguage;

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, he: { translation: he } },
  lng: resolveLanguage(),
  fallbackLng: 'en',
  // React already escapes what it renders
  interpolation: { escapeValue: false },
  initAsync: false,
});

if (typeof document !== 'undefined') {
  document.documentElement.lang = i18n.language;
  document.documentElement.dir = i18n.language === 'he' ? 'rtl' : 'ltr';
}

export default i18n;
