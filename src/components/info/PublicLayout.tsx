import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { BrandBackdrop, BrandLogo } from './BrandBar';
import { LANGUAGE_NAMES, applyLanguage } from '../../i18n';
import { savePreferences } from '../../services/preferencesService';

const navLink = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-lg text-sm font-medium text-white transition-all min-h-[38px] flex items-center ${
    isActive ? 'bg-white/30' : 'hover:bg-white/20'
  }`;

/** Switches between English and Hebrew; shows the other language's name, in its own script. */
function LanguageSwitch() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const next = i18n.language === 'he' ? 'en' : 'he';

  const change = () => {
    applyLanguage(next);
    // Signed in, it's the account's language too; failing that, it still applies on this device
    if (user) savePreferences({ language: next }).catch((e) => console.error('Saving language failed:', e instanceof Error ? e.message : e));
  };

  return (
    <button
      type="button"
      onClick={change}
      title={t('language.change')}
      className="px-3 py-2 rounded-lg text-sm font-medium text-white transition-all min-h-[38px] flex items-center gap-1.5 hover:bg-white/20"
    >
      <Languages className="h-4 w-4" aria-hidden />
      {/* The language's own name is the button's name; phones show only the icon */}
      <span lang={next} className="sr-only sm:not-sr-only">{LANGUAGE_NAMES[next]}</span>
    </button>
  );
}

/** Frame for the pages anyone can read, signed in or not: brand bar, page, footer. */
export function PublicLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <nav className="relative overflow-hidden shadow-md border-b border-gray-200/20">
        <BrandBackdrop />
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 relative z-10">
          <div className="h-16 flex items-center justify-between gap-2">
            <BrandLogo />
            <div className="flex items-center gap-1 sm:gap-2">
              <LanguageSwitch />
              <NavLink to="/about" className={navLink}>
                {t('nav.about')}
              </NavLink>
              <NavLink to="/guide" className={navLink}>
                {t('nav.guide')}
              </NavLink>
              <Link
                to={user ? '/' : '/login'}
                className="px-3 py-2 min-h-[38px] flex items-center bg-white/20 backdrop-blur-md text-white rounded-lg hover:bg-white/30 transition-all border border-white/40 text-sm font-medium shadow-lg"
              >
                {user ? t('nav.openOoga') : t('nav.signIn')}
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-gray-200 dark:border-gray-800 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
        <nav aria-label={t('nav.footer')} className="flex justify-center gap-4">
          <Link to="/about" className="hover:text-gray-700 dark:hover:text-gray-200">{t('nav.about')}</Link>
          <Link to="/guide" className="hover:text-gray-700 dark:hover:text-gray-200">{t('nav.guide')}</Link>
          <Link to={user ? '/' : '/login'} className="hover:text-gray-700 dark:hover:text-gray-200">
            {user ? t('nav.openOoga') : t('nav.signIn')}
          </Link>
        </nav>
        <p className="mt-3 text-xs">{t('footer.copyright')}</p>
      </footer>
    </div>
  );
}
