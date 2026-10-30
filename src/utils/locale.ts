import i18n from '../i18n';

/**
 * Returns the user's preferred locale from the browser's language settings.
 * 
 * `toLocaleDateString()` without arguments uses the OS system locale,
 * which may differ from the browser's language preference (e.g. macOS
 * set to en-US but Chrome set to en-GB). Using `navigator.language`
 * ensures dates/times respect the browser's configured language.
 */
export function getUserLocale(): string {
  // Hebrew screens format dates the Israeli way, whatever the browser is set to
  return i18n.language === 'he' ? 'he-IL' : navigator.language;
}

/** Locale for money: Israeli formatting on Hebrew screens, otherwise the app's long-standing en-US. */
export function getMoneyLocale(): string {
  return i18n.language === 'he' ? 'he-IL' : 'en-US';
}
