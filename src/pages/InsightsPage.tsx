import React, { useState, useMemo, useRef } from 'react';
import { useFinance } from '../context/FinanceContext';
import { useActiveBudget } from '../hooks/useBudgets';
import { BudgetVsActual } from '../components/analytics/BudgetVsActual';
import { CategoryAccuracyChart } from '../components/analytics/CategoryAccuracyChart';
import { CategoryPacingInsight } from '../components/analytics/CategoryPacingInsight';
import { HouseholdMemberExpenses } from '../components/analytics/HouseholdMemberExpenses';
import { DateRangeFilter } from '../components/analytics/DateRangeFilter';
import type { DateRangeType } from '../utils/dateRangeFilters';
import { TrendingUp, Target, LineChart, Users } from 'lucide-react';
import { getHeadingColor, getSubheadingColor } from '../utils/themeColors';

/**
 * Insights Page - Standalone analytics view
 * Moved from Budget Management > Analytics tab
 */
export const InsightsPage: React.FC = () => {
  const [dateRange, setDateRange] = useState<DateRangeType>('mtd');
  const { transactions } = useFinance();
  const { data: activeBudget, isLoading, error } = useActiveBudget();
  const dateRangeRef = useRef<HTMLDivElement>(null);

  const themeColor = 'indigo';

  // Calculate oldest transaction date for filtering available date ranges
  const oldestTransactionDate = useMemo(() => {
    if (transactions.length === 0) return undefined;
    const sorted = [...transactions].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    return new Date(sorted[0].date);
  }, [transactions]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
        <p className="text-gray-500 dark:text-gray-400">Loading insights...</p>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">Error loading budget data: {error.message}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div ref={dateRangeRef} className="mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className={`text-3xl font-bold ${getHeadingColor(themeColor)} mb-2`}>
            Insights
          </h1>
          <p className={getSubheadingColor(themeColor)}>
            Analyze your spending patterns and budget accuracy
          </p>
        </div>
        
        {/* Date Range Filter */}
        <DateRangeFilter 
          selectedRange={dateRange}
          onRangeChange={setDateRange}
          oldestTransactionDate={oldestTransactionDate}
        />
      </div>

      {/* Analytics Cards */}
      <div className="space-y-6">
        {/* Budget Summary */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Budget Summary
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Overview of planned vs actual spending
                </p>
              </div>
            </div>
          </div>
          <div className="p-4 sm:p-6">
            <BudgetVsActual selectedRange={dateRange} showSummaryOnly />
          </div>
        </div>

        {/* Category Performance */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
                <Target className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Original vs Current Budget Performance by Category
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Compare budgeted amounts with actual spending across categories
                </p>
              </div>
            </div>
          </div>
          <div className="p-4 sm:p-6">
            <BudgetVsActual selectedRange={dateRange} showChartOnly />
          </div>
        </div>

        {/* Category Accuracy */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-t-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg">
                <Target className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Category Accuracy
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  How well are you hitting your budget targets?
                </p>
              </div>
            </div>
          </div>
          <div className="p-4 sm:p-6">
            <CategoryAccuracyChart
              transactions={transactions}
              personalBudget={activeBudget}
              selectedRange={dateRange}
              onScrollToDateRange={() => {
                dateRangeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            />
          </div>
        </div>

        {/* Category Pacing */}
        <CategoryPacingInsight
          transactions={transactions}
          personalBudget={activeBudget}
          selectedRange={dateRange}
        />

        {/* Household Member Expenses */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-t-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/50 rounded-lg">
                <Users className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Household Member Expenses
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  See who's spending what in your household
                </p>
              </div>
            </div>
          </div>
          <div className="p-4 sm:p-6">
            <HouseholdMemberExpenses
              selectedRange={dateRange}
              globalSettings={activeBudget?.global_settings}
            />
          </div>
        </div>

        {/* Future: Spending Trends */}
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 p-8 text-center">
          <LineChart className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-500 dark:text-gray-400 mb-2">
            Coming Soon: Spending Trends
          </h3>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Track how your spending evolves over time with trend analysis
          </p>
        </div>
      </div>
    </div>
  );
};

export default InsightsPage;
