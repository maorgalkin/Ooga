import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveBudget, useCurrentMonthBudget, useNextMonthAdjustments } from '../hooks/useBudgets';
import { Calendar, Settings, Loader2, ArrowRight, Sparkles } from 'lucide-react';
import {
  getHeaderGradient,
  getTextColor,
  getPrimaryButtonBg,
  getPrimaryButtonHoverBg,
} from '../utils/themeColors';
import { getUserLocale } from '../utils/locale';

export const BudgetQuickView: React.FC = () => {
  const navigate = useNavigate();
  const { data: activeBudget, isLoading: loadingActive } = useActiveBudget();
  const { data: monthlyBudget, isLoading: loadingMonthly } = useCurrentMonthBudget();
  const { data: adjustments } = useNextMonthAdjustments();
  
  const themeColor = 'green';

  const formatCurrency = (amount: number): string => {
    const currency = activeBudget?.global_settings?.currency || 'USD';
    // Always use en-US locale for consistent left-side symbol placement
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  if (loadingActive || loadingMonthly) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          <span className="ms-2 text-gray-600 dark:text-gray-300">Loading budget...</span>
        </div>
      </div>
    );
  }

  const monthlyTotal = monthlyBudget
    ? Object.values(monthlyBudget.categories).filter(cat => cat.isActive).reduce((sum, cat) => sum + cat.monthlyLimit, 0)
    : 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
      {/* Header */}
      <div className={`px-6 py-4 ${getHeaderGradient(themeColor)}`}>
        <h3 className="text-lg font-semibold text-white">Budget Overview</h3>
        <p className={`text-sm ${getTextColor(themeColor)} mt-1`}>
          {new Date().toLocaleDateString(getUserLocale(), { month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Content */}
      <div className="p-6">
        {!activeBudget && !monthlyBudget ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Sparkles className="h-16 w-16 text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Welcome to Budget Management! 🎉
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">
              Get started by creating your first budget. Add your spending categories and set monthly limits.
            </p>
            <button
              onClick={() => navigate('/?tab=budget')}
              className={`px-6 py-3 ${getPrimaryButtonBg(themeColor)} text-white rounded-lg ${getPrimaryButtonHoverBg(themeColor)} transition-colors font-medium shadow-md hover:shadow-lg flex items-center gap-2`}
            >
              <Sparkles className="h-5 w-5" />
              Create Your First Budget
            </button>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
              💡 Tip: Start with categories like Groceries, Utilities, and Entertainment
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Stats Grid */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 mb-1">
                <Calendar className="h-4 w-4 me-1" />
                Monthly Budget
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {formatCurrency(monthlyTotal)}
              </p>
              {monthlyBudget?.is_locked && (
                <span className="inline-block text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-2 py-1 rounded mt-2">
                  Locked
                </span>
              )}
              {activeBudget && (
                <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 block truncate">
                  {activeBudget.name}
                </span>
              )}
            </div>

            {/* Pending Adjustments */}
            {adjustments && adjustments.adjustmentCount > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20">
                <div className="flex items-center">
                  <Settings className="h-5 w-5 me-2 text-orange-600 dark:text-orange-400" />
                  <span className="text-sm text-gray-900 dark:text-gray-100">
                    {adjustments.adjustmentCount} pending adjustment{adjustments.adjustmentCount !== 1 ? 's' : ''}
                  </span>
                </div>
                <span className="text-xs text-orange-700 dark:text-orange-300">
                  Next month
                </span>
              </div>
            )}

            {/* Quick Action */}
            <div className="pt-2">
              <button
                onClick={() => navigate('/?tab=budget')}
                className={`w-full flex items-center justify-center px-4 py-2 ${getPrimaryButtonBg(themeColor)} text-white rounded-md ${getPrimaryButtonHoverBg(themeColor)} transition-colors text-sm font-medium`}
              >
                View Details
                <ArrowRight className="h-4 w-4 ms-1 rtl:-scale-x-100" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
