import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useCurrentMonthBudget,
  useUpdateCategoryLimit,
  useLockMonthlyBudget,
  useUnlockMonthlyBudget,
  useBudgetComparison,
} from '../hooks/useBudgets';
import { Lock, Unlock, Edit2, Save, X, TrendingUp, TrendingDown, Minus, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { getUserLocale } from '../utils/locale';
import type { BudgetComparisonResult } from '../types/budget';

interface MonthlyBudgetViewProps {
  year?: number;
  month?: number;
  className?: string;
  hideWelcome?: boolean; // Don't show welcome message (already on budget page)
}

export const MonthlyBudgetView: React.FC<MonthlyBudgetViewProps> = ({
  year,
  month,
  className = '',
  hideWelcome = false,
}) => {
  const navigate = useNavigate();
  const currentDate = new Date();
  const targetYear = year ?? currentDate.getFullYear();
  const targetMonth = month ?? currentDate.getMonth() + 1;

  const { data: budget, isLoading, error } = useCurrentMonthBudget();
  const { data: comparison } = useBudgetComparison(targetYear, targetMonth);
  const updateCategory = useUpdateCategoryLimit();
  const lockBudget = useLockMonthlyBudget();
  const unlockBudget = useUnlockMonthlyBudget();

  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  const handleStartEdit = (categoryName: string, currentLimit: number) => {
    setEditingCategory(categoryName);
    setEditValue(currentLimit.toString());
  };

  const handleSaveEdit = async (categoryName: string) => {
    if (!budget) return;

    const newLimit = parseFloat(editValue);
    // Allow 0 (deactivation) but reject negative numbers
    if (isNaN(newLimit) || newLimit < 0) {
      alert('Please enter a valid number (0 or greater). Set to 0 to deactivate.');
      return;
    }

    try {
      await updateCategory.mutateAsync({
        monthlyBudgetId: budget.id,
        categoryName,
        newLimit,
      });
      setEditingCategory(null);
    } catch (error) {
      console.error('Error updating category:', error);
      alert('Failed to update category limit');
    }
  };

  const handleCancelEdit = () => {
    setEditingCategory(null);
    setEditValue('');
  };

  const handleToggleLock = async () => {
    if (!budget) return;

    try {
      if (budget.is_locked) {
        await unlockBudget.mutateAsync({ year: targetYear, month: targetMonth });
      } else {
        await lockBudget.mutateAsync({ year: targetYear, month: targetMonth });
      }
    } catch (error) {
      console.error('Error toggling lock:', error);
      alert(`Failed to ${budget.is_locked ? 'unlock' : 'lock'} budget`);
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getStatusIcon = (status: 'increased' | 'decreased' | 'unchanged' | 'added' | 'removed') => {
    switch (status) {
      case 'increased':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'decreased':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      case 'added':
        return <TrendingUp className="h-4 w-4 text-blue-600" />;
      case 'removed':
        return <TrendingDown className="h-4 w-4 text-gray-600" />;
      default:
        return <Minus className="h-4 w-4 text-gray-400" />;
    }
  };

  if (isLoading) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 ${className}`}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <span className="ms-3 text-gray-600 dark:text-gray-300">Loading budget...</span>
        </div>
      </div>
    );
  }

  if (error) {
    // Check if it's the "no active budget" error
    const isNoBudgetError = error.message.includes('No active personal budget');
    
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 ${className}`}>
        {isNoBudgetError && !hideWelcome ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Sparkles className="h-16 w-16 text-blue-500 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Welcome to Budget Management! 🎉
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">
              Get started by creating your first budget template. It's easy - just add your spending categories and set monthly limits.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  // Navigate to budget management page with create parameter
                  navigate('/budget-management?create=true');
                }}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-md hover:shadow-lg flex items-center gap-2"
              >
                <Sparkles className="h-5 w-5" />
                Create Your First Budget
              </button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
              💡 Tip: Start with a few main categories like Groceries, Utilities, and Entertainment
            </p>
          </div>
        ) : isNoBudgetError && hideWelcome ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              No monthly budget yet
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Create a budget template below to get started
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-center py-12 text-red-600 dark:text-red-400">
            <AlertCircle className="h-8 w-8 me-3" />
            <span>Error loading budget: {error.message}</span>
          </div>
        )}
      </div>
    );
  }

  if (!budget) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 ${className}`}>
        <div className="flex items-center justify-center py-12 text-gray-600 dark:text-gray-400">
          <AlertCircle className="h-8 w-8 me-3" />
          <span>No budget found for this month</span>
        </div>
      </div>
    );
  }

  // Create comparison map
  const comparisonMap = new Map<string, BudgetComparisonResult>(
    comparison?.comparisons.map(c => [c.category, c]) || []
  );

  // Calculate total budget from categories (only active)
  const totalBudget = Object.values(budget.categories)
    .filter(cat => cat.isActive)
    .reduce((sum, cat) => sum + cat.monthlyLimit, 0);

  // Calculate percentage change if we have comparison
  const totalPercentChange = comparison && comparison.totalPersonalLimit > 0
    ? (comparison.totalDifference / comparison.totalPersonalLimit) * 100
    : 0;

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {new Date(budget.year, budget.month - 1).toLocaleDateString(getUserLocale(), {
                month: 'long',
                year: 'numeric',
              })}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {budget.adjustment_count} adjustment{budget.adjustment_count !== 1 ? 's' : ''} made
            </p>
          </div>
          <button
            onClick={handleToggleLock}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              budget.is_locked
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
            disabled={lockBudget.isPending || unlockBudget.isPending}
          >
            {budget.is_locked ? (
              <>
                <Lock className="h-4 w-4" />
                Locked
              </>
            ) : (
              <>
                <Unlock className="h-4 w-4" />
                Unlocked
              </>
            )}
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Budget</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {formatCurrency(totalBudget)}
          </p>
        </div>
        {comparison && (
          <>
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">vs Personal</p>
              <p className={`text-2xl font-bold ${
                comparison.totalDifference > 0
                  ? 'text-green-600 dark:text-green-400'
                  : comparison.totalDifference < 0
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-900 dark:text-gray-100'
              }`}>
                {comparison.totalDifference > 0 ? '+' : ''}
                {formatCurrency(comparison.totalDifference)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">% Change</p>
              <p className={`text-2xl font-bold ${
                totalPercentChange > 0
                  ? 'text-green-600 dark:text-green-400'
                  : totalPercentChange < 0
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-900 dark:text-gray-100'
              }`}>
                {totalPercentChange > 0 ? '+' : ''}
                {totalPercentChange.toFixed(1)}%
              </p>
            </div>
          </>
        )}
      </div>

      {/* Categories List */}
      <div className="p-6">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
          Categories ({Object.keys(budget.categories).length})
        </h4>
        <div className="space-y-3">
          {Object.entries(budget.categories).map(([categoryName, category]) => {
            const isEditing = editingCategory === categoryName;
            const comparisonData = comparisonMap.get(categoryName);

            return (
              <div
                key={categoryName}
                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
              >
                <div className="flex items-center gap-3 flex-1">
                  {comparisonData && getStatusIcon(comparisonData.status)}
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {categoryName}
                    </div>
                    {comparisonData && comparisonData.difference !== 0 && comparisonData.personalLimit !== null && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Personal: {formatCurrency(comparisonData.personalLimit)}
                        {' '}({comparisonData.differencePercentage > 0 ? '+' : ''}
                        {comparisonData.differencePercentage.toFixed(1)}%)
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {isEditing ? (
                    <>
                      <input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveEdit(categoryName)}
                        className="p-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                        disabled={updateCategory.isPending}
                      >
                        <Save className="h-4 w-4" />
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="p-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-lg font-semibold text-gray-900 dark:text-gray-100 min-w-[100px] text-end">
                        {formatCurrency(category.monthlyLimit)}
                      </span>
                      {!budget.is_locked && (
                        <button
                          onClick={() => handleStartEdit(categoryName, category.monthlyLimit)}
                          className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-md hover:bg-blue-200 dark:hover:bg-blue-900/50"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {budget.is_locked && (
          <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
            <Lock className="h-4 w-4" />
            This budget is locked. Unlock it to make changes.
          </div>
        )}
      </div>
    </div>
  );
};
