import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useT } from '../hooks/useT';
import { useFinance } from '../context/FinanceContext';
import { useActiveBudget, useMonthlyBudget, useNextMonthAdjustments } from '../hooks/useBudgets';
import { budgetService } from '../services/budgetService';
import { toBudgetConfiguration, useBudgetAlerts } from '../hooks/useBudgetAlerts';
import { getUserLocale } from '../utils/locale';
import { 
  AlertTriangle, 
  CheckCircle, 
  Target, 
  Calendar, 
  Settings, 
  Loader2, 
  ArrowRight, 
  Sparkles,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import type { BudgetConfiguration } from '../types';
import { getHeaderGradient, getAccentColor, getTextColor, getPrimaryButtonBg, getPrimaryButtonHoverBg, type ThemeColor } from '../utils/themeColors';
import { formatCurrencyFromSettings } from '../utils/formatCurrency';

interface BudgetPerformanceCardProps {
  selectedMonth?: Date;
  isCompact?: boolean;
  themeColor?: ThemeColor;
  onBreakdownVisible?: (visible: boolean) => void;
  onCategoryClick?: (category: string) => void;
}

export const BudgetPerformanceCard: React.FC<BudgetPerformanceCardProps> = ({ 
  selectedMonth, 
  isCompact = false,
  themeColor = 'purple',
  onBreakdownVisible,
  onCategoryClick
}) => {
  const navigate = useNavigate();
  const t = useT();
  const { transactions } = useFinance();
  const { data: personalBudget, isLoading: loadingActive } = useActiveBudget();
  
  // Extract year and month from selectedMonth to fetch the correct monthly budget
  const selectedYear = selectedMonth ? selectedMonth.getFullYear() : undefined;
  const selectedMonthNum = selectedMonth ? selectedMonth.getMonth() + 1 : undefined; // 1-indexed
  
  const { data: monthlyBudget, isLoading: loadingMonthly } = useMonthlyBudget(selectedYear, selectedMonthNum);
  const { data: adjustments } = useNextMonthAdjustments();
  const [showDetails, setShowDetails] = useState(false);
  const [viewingAlerts, setViewingAlerts] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const categoryBreakdownRef = useRef<HTMLDivElement>(null);
  // Intersection observer to detect when summary scrolls out of view (breakdown is visible)
  useEffect(() => {
    if (!onBreakdownVisible || isCompact || loadingActive || loadingMonthly) return;

    const element = summaryRef.current;
    if (!element) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        // When summary is NOT intersecting (scrolled out), breakdown is visible
        const breakdownVisible = !entry.isIntersecting;
        onBreakdownVisible(breakdownVisible);
      },
      {
        threshold: 0,
        rootMargin: '-60px 0px 0px 0px' // Account for sticky header height
      }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [onBreakdownVisible, isCompact, loadingActive, loadingMonthly]);

  // Convert budget to BudgetConfiguration format for budgetService
  // Use monthly budget categories (current month values including mid-month edits)
  // with fallback to personal budget
  const budgetConfig = useMemo((): BudgetConfiguration => {
    if (personalBudget) return toBudgetConfiguration(personalBudget, monthlyBudget);
    // Default minimal config if no budget exists
    return {
      version: "2.0.0",
      lastUpdated: new Date().toISOString(),
      categories: {},
      globalSettings: {
        currency: 'ILS',
        warningNotifications: true,
        emailAlerts: false
      }
    };
  }, [personalBudget, monthlyBudget]);

  // Get current month or use selected month
  const currentDate = selectedMonth || new Date();
  // Unseen alerts show as dots on their rows; opening a row marks its alert seen
  const { unseenFor, markCategorySeen } = useBudgetAlerts(currentDate);
  const openCategory = (category: string) => {
    markCategorySeen(category);
    onCategoryClick?.(category);
  };
  // English month name required by budget service for date parsing
  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long' });
  const displayMonthName = currentDate.toLocaleDateString(getUserLocale(), { month: 'long' });
  const year = currentDate.getFullYear();

  // Calculate budget analysis for the selected month
  const budgetAnalysis = useMemo(() => {
    return budgetService.analyzeBudgetPerformanceWithConfig(transactions, monthName, year, budgetConfig);
  }, [transactions, monthName, year, budgetConfig]);

  // Calculate income and balance for the selected month
  const monthIncome = useMemo(() => {
    return transactions
      .filter(t => {
        const date = new Date(t.date);
        return date.getMonth() === currentDate.getMonth() && 
               date.getFullYear() === year &&
               t.type === 'income';
      })
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions, currentDate, year]);

  const monthExpense = budgetAnalysis.totalSpent;
  const balance = monthIncome - monthExpense;

  const formatCurrency = (amount: number) => {
    return formatCurrencyFromSettings(amount, personalBudget?.global_settings);
  };

  const getStatusIcon = (status: 'under' | 'over' | 'near') => {
    switch (status) {
      case 'under': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'over': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'near': return <Target className="h-4 w-4 text-blue-600" />;
    }
  };

  const budgetUtilization = budgetAnalysis.totalBudgeted > 0 
    ? (budgetAnalysis.totalSpent / budgetAnalysis.totalBudgeted) * 100 
    : 0;

  const categoriesOverBudget = budgetAnalysis.categoryComparisons.filter(c => c.status === 'over').length;

  // Calculate average warning threshold across all active categories
  const averageWarningThreshold = useMemo(() => {
    if (!budgetConfig.categories) return 80;
    
    const activeCategories = Object.entries(budgetConfig.categories)
      .filter(([, config]) => config.isActive);
    
    if (activeCategories.length === 0) return 80;
    
    const totalThreshold = activeCategories.reduce(
      (sum, [, config]) => sum + (config.warningThreshold || 80),
      0
    );
    
    return totalThreshold / activeCategories.length;
  }, [budgetConfig.categories]);

  if (loadingActive || loadingMonthly) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          <span className="ms-2 text-gray-600 dark:text-gray-300">{t('dashboard.performance.loading')}</span>
        </div>
      </div>
    );
  }

  // No Budget State
  if (!personalBudget && !monthlyBudget) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        <div className={`px-6 py-4 ${getHeaderGradient(themeColor)}`}>
          <h3 className="text-lg font-semibold text-white">{t('dashboard.budgetPerformance')}</h3>
          <p className={`text-sm ${getTextColor(themeColor)} mt-1`}>
            {displayMonthName} {year}
          </p>
        </div>

        <div className="p-8">
          <div className="flex flex-col items-center justify-center text-center">
            <Sparkles className="h-16 w-16 text-blue-500 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {t('dashboard.performance.welcomeTitle')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">
              {t('dashboard.performance.welcomeBody')}
            </p>
            <button
              onClick={() => navigate('/?tab=budget')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-md hover:shadow-lg flex items-center gap-2"
            >
              <Sparkles className="h-5 w-5" />
              {t('dashboard.performance.createFirst')}
            </button>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
              {t('dashboard.performance.tip')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
      {/* Header - Hidden on mobile, shown on desktop */}
      <div className={`max-md:hidden px-6 py-4 ${getHeaderGradient(themeColor)}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">{t('dashboard.budgetPerformance')}</h3>
            <p className={`text-sm ${getTextColor(themeColor)} mt-1`}>
              {displayMonthName} {year}
            </p>
          </div>
          {personalBudget && (
            <span className={`text-xs ${getTextColor(themeColor)} ${getAccentColor(themeColor)} px-2 py-1 rounded truncate max-w-[150px]`}>
              {personalBudget.name}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Summary Grid - Always Visible */}
        <div ref={summaryRef} className={`grid ${isCompact ? 'grid-cols-3' : 'grid-cols-2 md:grid-cols-3'} gap-4 mb-4`}>
          {/* Income */}
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('common.income')}</p>
            <p className="text-lg font-bold text-green-900 dark:text-green-400">{formatCurrency(monthIncome)}</p>
          </div>

          {/* Expense */}
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('dashboard.performance.expense')}</p>
            <p className="text-lg font-bold text-red-900 dark:text-red-400">{formatCurrency(monthExpense)}</p>
          </div>

          {/* Balance */}
          <div className={`rounded-lg p-4 ${balance >= 0 ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-orange-50 dark:bg-orange-900/20'}`}>
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('common.balance')}</p>
            <p className={`text-lg font-bold ${balance >= 0 ? 'text-blue-900 dark:text-blue-400' : 'text-orange-900 dark:text-orange-400'}`}>
              {formatCurrency(balance)}
            </p>
          </div>

          {/* Budget Total */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
            <div className="flex items-center text-xs text-gray-600 dark:text-gray-400 mb-1">
              <Calendar className="h-3 w-3 me-1" />
              {t('dashboard.tiles.budgeted')}
            </div>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatCurrency(budgetAnalysis.totalBudgeted)}</p>
            {monthlyBudget?.is_locked && (
              <span className="inline-block text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded mt-1">
                {t('dashboard.performance.locked')}
              </span>
            )}
          </div>

          {/* Budget Status */}
          <div className={`rounded-lg p-4 ${
            budgetUtilization <= averageWarningThreshold ? 'bg-green-50 dark:bg-green-900/20' : 
            budgetUtilization <= 100 ? 'bg-yellow-50 dark:bg-yellow-900/20' : 
            'bg-red-50 dark:bg-red-900/20'
          }`}>
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('dashboard.performance.status')}</p>
            <p className={`text-sm font-bold ${
              budgetUtilization <= averageWarningThreshold ? 'text-green-900 dark:text-green-400' : 
              budgetUtilization <= 100 ? 'text-yellow-900 dark:text-yellow-400' : 
              'text-red-900 dark:text-red-400'
            }`}>
              {categoriesOverBudget === 0 ? t('dashboard.performance.onTrack') : t('dashboard.performance.over', { count: categoriesOverBudget })}
            </p>
            <p className={`text-xs font-medium mt-0.5 ${
              budgetUtilization <= averageWarningThreshold ? 'text-green-700 dark:text-green-500' : 
              budgetUtilization <= 100 ? 'text-yellow-700 dark:text-yellow-500' : 
              'text-red-700 dark:text-red-500'
            }`}>
              {t('dashboard.performance.percentUsed', { percent: budgetUtilization.toFixed(1) })}
            </p>
          </div>

          {/* Variance */}
          <div className={`rounded-lg p-4 ${budgetAnalysis.totalVariance >= 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20'}`}>
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('dashboard.tiles.variance')}</p>
            <p className={`text-lg font-bold ${budgetAnalysis.totalVariance >= 0 ? 'text-red-900 dark:text-red-400' : 'text-green-900 dark:text-green-400'}`}>
              {budgetAnalysis.totalVariance >= 0 ? '+' : ''}{formatCurrency(budgetAnalysis.totalVariance)}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('dashboard.performance.progress')}</span>
            <span className="text-sm text-gray-600 dark:text-gray-400">{budgetUtilization.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${
                budgetUtilization <= averageWarningThreshold ? 'bg-green-500' : 
                budgetUtilization <= 100 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(budgetUtilization, 100)}%` }}
            ></div>
          </div>
        </div>

        {/* Alerts Preview */}
        {budgetAnalysis.alerts.length > 0 && !showDetails && !viewingAlerts && (
          <div className="mb-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20 border-s-4 border-orange-400">
              <div className="flex items-center">
                <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400 me-2" />
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {t('dashboard.performance.alerts', { count: budgetAnalysis.alerts.length })}
                </span>
              </div>
              <button
                onClick={() => {
                  setViewingAlerts(true);
                  setShowDetails(true);
                }}
                className="text-sm text-orange-700 dark:text-orange-300 hover:text-orange-800 dark:hover:text-orange-200 font-medium"
              >
                {t('dashboard.performance.view')}
              </button>
            </div>
          </div>
        )}

        {/* Pending Adjustments */}
        {adjustments && adjustments.adjustmentCount > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border-s-4 border-purple-400">
              <div className="flex items-center">
                <Settings className="h-5 w-5 text-purple-600 dark:text-purple-400 me-2" />
                <span className="text-sm text-gray-900 dark:text-gray-100">
                  {t('dashboard.performance.pending', { count: adjustments.adjustmentCount })}
                </span>
              </div>
              <span className="text-xs text-purple-700 dark:text-purple-300">
                {t('dashboard.performance.nextMonth')}
              </span>
            </div>
          </div>
        )}

        {/* Detailed Category Breakdown */}
        {(showDetails || !isCompact) && (
          <div ref={categoryBreakdownRef} className="mb-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {viewingAlerts ? t('dashboard.performance.alertCategories') : t('dashboard.tiles.categoryBreakdown')}
              </h4>
              {viewingAlerts && (
                <button
                  onClick={() => setViewingAlerts(false)}
                  className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  {t('dashboard.tiles.showAll')}
                </button>
              )}
            </div>
            <div className={`space-y-3 ${isCompact ? 'max-h-96 overflow-y-auto' : ''}`}>
              {budgetAnalysis.categoryComparisons
                .filter(comp => {
                  if (comp.budgeted === 0) return false;
                  // If viewing alerts, only show categories with alerts
                  if (viewingAlerts) {
                    const hasAlert = budgetAnalysis.alerts.some(alert => alert.category === comp.category);
                    return hasAlert;
                  }
                  return true;
                })
                .sort((a, b) => b.budgeted - a.budgeted)
                .map((comparison) => {
                  const utilization = comparison.budgeted > 0 ? (comparison.actual / comparison.budgeted) * 100 : 0;
                  const categoryAlert = unseenFor(comparison.category);
                  
                  return (
                    <div
                      key={comparison.category}
                      role="button"
                      tabIndex={0}
                      aria-label={t('dashboard.performance.viewDetails', { category: comparison.category })}
                      className="block w-full border border-gray-200 dark:border-gray-700 rounded-lg p-3 cursor-pointer active:bg-gray-100 dark:active:bg-gray-700/50 transition-colors"
                      onClick={() => openCategory(comparison.category)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openCategory(comparison.category);
                        }
                      }}
                    >                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center">
                          {getStatusIcon(comparison.status)}
                          <span className="ms-2 text-sm font-medium text-gray-900 dark:text-gray-100">{comparison.category}</span>
                          {categoryAlert && (
                            <span
                              role="img"
                              aria-label={t(categoryAlert.level === 'over' ? 'dashboard.alertDot.over' : 'dashboard.alertDot.near')}
                              className={`ms-2 w-2 h-2 rounded-full ${categoryAlert.level === 'over' ? 'bg-red-500' : 'bg-amber-400'}`}
                            />
                          )}
                        </div>
                        <div className="text-end">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {formatCurrency(comparison.actual)} / {formatCurrency(comparison.budgeted)}
                          </div>
                        </div>
                      </div>
                      
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mb-1">
                        <div 
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            utilization <= (budgetConfig.categories[comparison.category]?.warningThreshold || 80) ? 'bg-green-500' : 
                            utilization <= 100 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(utilization, 100)}%` }}
                        ></div>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500 dark:text-gray-400">{utilization.toFixed(1)}%</span>
                        {utilization > 100 && (
                          <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                            {t('dashboard.performance.overBy', { amount: formatCurrency(comparison.variance) })}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          {/* Show Details button - only visible on desktop/compact mode */}
          {isCompact && (
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex-1 flex items-center justify-center px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
            >
              {showDetails ? (
                <>
                  <ChevronUp className="h-4 w-4 me-1" />
                  {t('dashboard.performance.showLess')}
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 me-1" />
                  {t('dashboard.performance.showDetails')}
                </>
              )}
            </button>
          )}
          <button
            onClick={() => navigate('/?tab=budget')}
            className={`flex-1 flex items-center justify-center px-4 py-2 text-white rounded-md transition-colors text-sm font-medium ${getPrimaryButtonBg(themeColor)} ${getPrimaryButtonHoverBg(themeColor)}`}
          >
            {t('dashboard.performance.manage')}
            <ArrowRight className="h-4 w-4 ms-1 rtl:-scale-x-100" />
          </button>
        </div>
      </div>
    </div>
  );
};
