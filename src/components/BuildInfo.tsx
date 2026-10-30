import React from 'react';
import { getUserLocale } from '../utils/locale';
import { useTranslation } from 'react-i18next';

interface BuildInfoProps {
  inline?: boolean; // If true, render inline at bottom of page instead of floating
}

export const BuildInfo: React.FC<BuildInfoProps> = ({ inline = false }) => {
  const { t } = useTranslation();
  const commit = import.meta.env.VITE_GIT_COMMIT;
  const branch = import.meta.env.VITE_GIT_BRANCH;
  const buildTime = import.meta.env.VITE_BUILD_TIME;
  const isDev = import.meta.env.DEV;

  const handleClick = () => {
    if (isDev) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (inline) {
    // Production: inline version at bottom of page
    return (
      <div className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs px-4 py-3 border-t border-gray-200 dark:border-gray-700 font-mono">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-white ${isDev ? 'bg-yellow-600' : 'bg-green-600'}`}>
              {isDev ? 'DEV' : 'PROD'}
            </span>
            <span>{branch}</span>
          </div>
          <div className="flex gap-4 text-gray-500 dark:text-gray-500">
            {commit && <div>{t('buildInfo.commit')} {commit}</div>}
            {buildTime && <div>{t('buildInfo.built')} {new Date(buildTime).toLocaleString(getUserLocale())}</div>}
          </div>
        </div>
      </div>
    );
  }

  // Dev: floating version with click to scroll to top
  return (
    <button
      onClick={handleClick}
      className="fixed bottom-2 end-2 bg-gray-800 text-white text-xs px-3 py-2 rounded-lg shadow-lg opacity-75 hover:opacity-100 transition-opacity font-mono z-50 cursor-pointer hover:bg-gray-700"
      title={t('buildInfo.scrollToTop')}
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded ${isDev ? 'bg-yellow-600' : 'bg-green-600'}`}>
            {isDev ? 'DEV' : 'PROD'}
          </span>
          <span>{branch}</span>
        </div>
        <div className="text-gray-300">
          {commit && <div>{t('buildInfo.commit')} {commit}</div>}
          {buildTime && <div>{t('buildInfo.built')} {new Date(buildTime).toLocaleString(getUserLocale())}</div>}
        </div>
      </div>
    </button>
  );
};
