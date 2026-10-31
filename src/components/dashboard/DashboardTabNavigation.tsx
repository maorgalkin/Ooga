import React from 'react';
import { useT } from '../../hooks/useT';

interface DashboardTabNavigationProps {
  activeTab: 'dashboard' | 'transactions' | 'budget' | 'insights';
  onTabChange: (tab: 'dashboard' | 'transactions' | 'budget' | 'insights') => void;
  alertsCount?: number;
}

/**
 * Tab navigation component for switching between Dashboard, Transactions, Budget, and Insights views
 */
export const DashboardTabNavigation: React.FC<DashboardTabNavigationProps> = ({
  activeTab,
  onTabChange,
  alertsCount = 0,
}) => {
  const t = useT();
  return (
    <div className="mb-6">
      <div className="border-b-2 border-gray-200 dark:border-gray-700">
        <nav className="flex justify-between sm:justify-start">
          <button
            onClick={() => onTabChange('dashboard')}
            className={`pt-3 pb-2 px-2 sm:px-4 font-medium text-sm transition-colors flex flex-col items-center ${
              activeTab === 'dashboard'
                ? 'text-purple-600 dark:text-purple-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {/* The badge sits beside the label, raised, so it never covers the label's last letters */}
            <span className="inline-flex items-start gap-0.5">
              {t('tabs.dashboard')}
              {alertsCount > 0 && (
                <>
                  <span aria-hidden title={t('dashboard.newAlerts', { count: alertsCount })} className="-mt-1.5 min-w-[1.125rem] h-[1.125rem] px-1 rounded-full bg-red-500 text-white text-[0.6875rem] leading-none font-semibold flex items-center justify-center">
                    {alertsCount}
                  </span>
                  <span className="sr-only">{t('dashboard.newAlerts', { count: alertsCount })}</span>
                </>
              )}
            </span>
            <span className={`mt-2 w-4 h-1 rounded-full translate-y-[7px] ${activeTab === 'dashboard' ? 'bg-purple-500' : 'bg-transparent'}`} />
          </button>
          <button
            onClick={() => onTabChange('transactions')}
            className={`pt-3 pb-2 px-2 sm:px-4 font-medium text-sm transition-colors flex flex-col items-center ${
              activeTab === 'transactions'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <span>{t('tabs.transactions')}</span>
            <span className={`mt-2 w-4 h-1 rounded-full translate-y-[7px] ${activeTab === 'transactions' ? 'bg-blue-500' : 'bg-transparent'}`} />
          </button>
          <button
            onClick={() => onTabChange('budget')}
            className={`pt-3 pb-2 px-2 sm:px-4 font-medium text-sm transition-colors flex flex-col items-center ${
              activeTab === 'budget'
                ? 'text-green-600 dark:text-green-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <span>{t('tabs.budget')}</span>
            <span className={`mt-2 w-4 h-1 rounded-full translate-y-[7px] ${activeTab === 'budget' ? 'bg-green-500' : 'bg-transparent'}`} />
          </button>
          <button
            onClick={() => onTabChange('insights')}
            className={`pt-3 pb-2 px-2 sm:px-4 font-medium text-sm transition-colors flex flex-col items-center ${
              activeTab === 'insights'
                ? 'text-indigo-600 dark:text-indigo-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <span>{t('tabs.insights')}</span>
            <span className={`mt-2 w-4 h-1 rounded-full translate-y-[7px] ${activeTab === 'insights' ? 'bg-indigo-500' : 'bg-transparent'}`} />
          </button>
        </nav>
      </div>
    </div>
  );
};
