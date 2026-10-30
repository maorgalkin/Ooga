import React from 'react';
import { useActiveBudget, useCurrentMonthBudget } from '../hooks/useBudgets';
import { Loader2, DollarSign } from 'lucide-react';
import {
  getInactiveBg,
  getIconColor,
} from '../utils/themeColors';
import { formatCurrencyFromSettings } from '../utils/formatCurrency';

interface PersonalBudgetDisplayProps {
  className?: string;
  /** Called when a category tile is clicked (passes category name) */
  onCategoryClick?: (categoryName: string) => void;
}

export const PersonalBudgetDisplay: React.FC<PersonalBudgetDisplayProps> = ({
  className = '',
  onCategoryClick,
}) => {
  const { data: activeBudget, isLoading } = useActiveBudget();
  const { data: currentMonthBudget } = useCurrentMonthBudget();
  const themeColor = 'green';

  const formatCurrency = (amount: number): string => {
    return formatCurrencyFromSettings(amount, activeBudget?.global_settings);
  };

  // Get the current month's limit for a category (from monthly budget, with fallback to personal budget)
  const getCurrentMonthLimit = (categoryName: string, fallbackLimit: number): number => {
    if (currentMonthBudget?.categories?.[categoryName]) {
      return currentMonthBudget.categories[categoryName].monthlyLimit;
    }
    return fallbackLimit;
  };

  if (isLoading) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 ${className}`}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          <span className="ms-3 text-gray-600 dark:text-gray-300">Loading budget...</span>
        </div>
      </div>
    );
  }

  if (!activeBudget) {
    return null;
  }

  // Use current month budget values for totals (includes mid-month edits)
  const activeCategories = Object.entries(activeBudget.categories).filter(
    ([_, cat]) => cat.isActive
  );

  const totalBudget = activeCategories.reduce((sum, [name, cat]) => {
    return sum + getCurrentMonthLimit(name, cat.monthlyLimit);
  }, 0);

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {activeBudget.name}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {activeCategories.length} categories • {formatCurrency(totalBudget)} monthly budget
          </p>
        </div>
      </div>

      {/* Budget Summary */}
      <div className={`px-6 py-4 border-b border-gray-200 dark:border-gray-700 ${getInactiveBg(themeColor)}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <DollarSign className={`h-5 w-5 ${getIconColor(themeColor)} me-2`} />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Total Monthly Budget
            </span>
          </div>
          <span className={`text-2xl font-bold ${getIconColor(themeColor)}`}>
            {formatCurrency(totalBudget)}
          </span>
        </div>
      </div>

      {/* Categories Grid */}
      <div className="px-6 py-4">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Click a category to edit
          </span>
        </div>
        <div className="budget-category-grid">
          {activeCategories.map(([name, config]) => (
            <div
              key={name}
              onClick={() => onCategoryClick?.(name)}
              className={`p-4 bg-white dark:bg-gray-700 rounded-lg border-2 border-gray-200 dark:border-gray-600 hover:shadow-md transition-all ${onCategoryClick ? 'cursor-pointer hover:border-green-400 dark:hover:border-green-500' : ''}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 flex-1">
                  {/* Color Badge */}
                  {config.color && (
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: config.color }}
                    />
                  )}
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate">
                    {name}
                  </h4>
                </div>
                {!config.isActive && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">Inactive</span>
                )}
              </div>
              
              <div className="space-y-1">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Limit</span>
                  <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {formatCurrency(getCurrentMonthLimit(name, config.monthlyLimit))}
                  </span>
                </div>
                
                {config.warningThreshold && (
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Warning</span>
                    <span className="text-xs font-medium text-yellow-600 dark:text-yellow-400">
                      {config.warningThreshold}%
                    </span>
                  </div>
                )}
                
                {config.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 line-clamp-2">
                    {config.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {activeBudget.notes && (
          <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium">Notes:</span> {activeBudget.notes}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
