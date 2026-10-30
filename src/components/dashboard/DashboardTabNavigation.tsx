import React from 'react';

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
            <span className="relative">
              Dashboard
              {alertsCount > 0 && (
                <span className="absolute -top-1 -end-3 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {alertsCount}
                </span>
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
            <span>Transactions</span>
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
            <span>Budget</span>
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
            <span>Insights</span>
            <span className={`mt-2 w-4 h-1 rounded-full translate-y-[7px] ${activeTab === 'insights' ? 'bg-indigo-500' : 'bg-transparent'}`} />
          </button>
        </nav>
      </div>
    </div>
  );
};
