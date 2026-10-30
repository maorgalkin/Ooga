import React from 'react';
import { useBudgetComparison, useBudgetComparisonToOriginal } from '../hooks/useBudgets';
import { TrendingUp, TrendingDown, Minus, AlertCircle, Loader2, MinusCircle } from 'lucide-react';

interface BudgetComparisonCardProps {
  year: number;
  month: number;
  compareToOriginal?: boolean; // If true, compare to month-start; if false, compare to personal budget
  className?: string;
}

export const BudgetComparisonCard: React.FC<BudgetComparisonCardProps> = ({
  year,
  month,
  compareToOriginal = false,
  className = '',
}) => {
  const { data: personalComparison, isLoading: isLoadingPersonal, error: errorPersonal } = useBudgetComparison(year, month);
  const { data: originalComparison, isLoading: isLoadingOriginal, error: errorOriginal } = useBudgetComparisonToOriginal(year, month);

  // Use the appropriate comparison based on prop
  const comparison = compareToOriginal ? originalComparison : personalComparison;
  const isLoading = compareToOriginal ? isLoadingOriginal : isLoadingPersonal;
  const error = compareToOriginal ? errorOriginal : errorPersonal;

  if (isLoading) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <span className="ms-3 text-gray-600 dark:text-gray-300">Loading comparison...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 ${className}`}>
        <div className="flex items-center text-red-600 dark:text-red-400">
          <AlertCircle className="h-5 w-5 me-2" />
          <span>Error loading budget comparison</span>
        </div>
      </div>
    );
  }

  if (!comparison) {
    return null;
  }

  const formatCurrency = (amount: number): string => {
    const currency = comparison?.currency || 'USD';
    // Always use en-US locale for consistent left-side symbol placement
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const getStatusIcon = (status: 'increased' | 'decreased' | 'unchanged' | 'added' | 'removed') => {
    switch (status) {
      case 'increased':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'decreased':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      case 'added':
        return <TrendingUp className="h-4 w-4 text-blue-500" />;
      case 'removed':
        return <MinusCircle className="h-4 w-4 text-orange-500" />;
      case 'unchanged':
        return <Minus className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: 'increased' | 'decreased' | 'unchanged' | 'added' | 'removed') => {
    switch (status) {
      case 'increased':
        return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20';
      case 'decreased':
        return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
      case 'added':
        return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20';
      case 'removed':
        return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20';
      case 'unchanged':
        return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20';
    }
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {comparison.monthlyBudgetDate} compared to {compareToOriginal ? 'Month Start' : 'My Budget'}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
          {comparison.adjustedCategories} adjusted · {comparison.addedCategories} added · {comparison.activeCategories} active
        </p>
      </div>

      {/* Summary */}
      <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              {compareToOriginal ? 'Month Start' : 'My Budget'}
            </p>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-1">
              {formatCurrency(comparison.totalPersonalLimit)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {compareToOriginal ? 'Original budget' : 'Base configuration'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{comparison.monthlyBudgetDate}</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-1">
              {formatCurrency(comparison.totalMonthlyLimit)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Active categories
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Net Change</p>
            <p className={`text-lg font-semibold mt-1 ${
              comparison.totalDifference > 0 
                ? 'text-green-600 dark:text-green-400' 
                : comparison.totalDifference < 0 
                  ? 'text-red-600 dark:text-red-400' 
                  : 'text-gray-600 dark:text-gray-400'
            }`}>
              {comparison.totalDifference > 0 && '+'}
              {formatCurrency(comparison.totalDifference)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              From adjustments
            </p>
          </div>
        </div>
      </div>

      {/* Category Comparisons */}
      <div className="px-6 py-4 max-h-96 overflow-y-auto">
        <div className="space-y-3">
          {comparison.comparisons.map((item) => (
            <div
              key={item.category}
              className={`flex items-center justify-between py-3 px-4 rounded-lg transition-colors ${
                item.status === 'removed' 
                  ? 'bg-gray-50 dark:bg-gray-800 opacity-75' 
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}
            >
              <div className="flex items-center space-x-3 rtl:space-x-reverse flex-1">
                <div className="flex items-center justify-center w-8 h-8">
                  {getStatusIcon(item.status)}
                </div>
                <div className="flex-1">
                  <p className={`font-medium ${
                    item.status === 'removed' 
                      ? 'text-gray-500 dark:text-gray-400 line-through' 
                      : 'text-gray-900 dark:text-gray-100'
                  }`}>
                    {item.category}
                  </p>
                  <div className="flex items-center space-x-2 rtl:space-x-reverse mt-1">
                    {item.status === 'removed' ? (
                      <>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {formatCurrency(item.personalLimit!)}
                        </span>
                        <span className="text-gray-400">→</span>
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Deactivated
                        </span>
                      </>
                    ) : item.personalLimit !== null ? (
                      <>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {formatCurrency(item.personalLimit)}
                        </span>
                        <span className="text-gray-400">→</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {formatCurrency(item.monthlyLimit)}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-sm text-gray-500 dark:text-gray-400 italic">
                          Not in My Budget →
                        </span>
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {formatCurrency(item.monthlyLimit)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(item.status)}`}>
                {item.status === 'added' && (
                  <span>New this month</span>
                )}
                {item.status === 'removed' && (
                  <span>{formatCurrency(item.difference)}</span>
                )}
                {item.status === 'unchanged' && (
                  <span>No change</span>
                )}
                {(item.status === 'increased' || item.status === 'decreased') && (
                  <>
                    {item.difference > 0 && '+'}
                    {formatCurrency(item.difference)}
                    <span className="ms-1 text-xs">
                      ({item.differencePercentage > 0 && '+'}
                      {item.differencePercentage.toFixed(1)}%)
                    </span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
