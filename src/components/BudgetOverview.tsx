import React, { useState, useMemo } from 'react';
import { useFinance } from '../context/FinanceContext';
import { useActiveBudget, useCurrentMonthBudget } from '../hooks/useBudgets';
import { budgetService } from '../services/budgetService';
import { AlertTriangle, CheckCircle, Target, HelpCircle, X } from 'lucide-react';
import type { BudgetConfiguration } from '../types';
import { formatCurrencyFromSettings } from '../utils/formatCurrency';
import { getUserLocale } from '../utils/locale';

interface BudgetOverviewProps {
  selectedMonth?: Date;
  isCompact?: boolean;
}

const BudgetOverview: React.FC<BudgetOverviewProps> = ({ selectedMonth, isCompact = false }) => {
  const { transactions } = useFinance();
  const { data: personalBudget } = useActiveBudget();
  const { data: monthlyBudget } = useCurrentMonthBudget();
  const [showDetails, setShowDetails] = useState(false);
  const [showProgressHelp, setShowProgressHelp] = useState(false);

  // Convert budget to BudgetConfiguration format
  // Use monthly budget categories (current month values including mid-month edits)
  const budgetConfig = useMemo((): BudgetConfiguration => {
    if (personalBudget) {
      // Use monthly budget categories if available, otherwise personal budget
      const categories = monthlyBudget?.categories 
        ? { ...monthlyBudget.categories }
        : { ...personalBudget.categories };
      
      return {
        version: "2.0.0",
        lastUpdated: monthlyBudget?.updated_at || personalBudget.updated_at,
        categories,
        globalSettings: personalBudget.global_settings
      };
    }
    // Return default config if no personal budget
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

  const getStatusColor = (status: 'under' | 'over' | 'near') => {
    switch (status) {
      case 'under': return 'text-green-600';
      case 'over': return 'text-red-600';
      case 'near': return 'text-blue-600';
    }
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

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${isCompact ? 'p-4' : 'p-6'}`}>
      <div className="flex justify-between items-center mb-4">
        <h3 className={`font-semibold text-gray-900 ${isCompact ? 'text-base' : 'text-lg'}`}>
          {displayMonthName} {year} Budget Performance
        </h3>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
        >
          {showDetails ? 'Hide Details' : 'Show Details'}
        </button>
      </div>

      {/* Budget Summary Cards - Desktop: 3 across x 2 down, Mobile: 2 across x 3 down */}
      <div className={`grid ${isCompact ? 'grid-cols-3 gap-3' : 'grid-cols-2 md:grid-cols-3 gap-4'} ${isCompact ? 'mb-4' : 'mb-6'}`}>
        {/* Row 1: Income | Expense | Balance */}
        <div className={`bg-green-50 rounded-lg ${isCompact ? 'p-3' : 'p-4'}`}>
          <div className="flex flex-col">
            <p className={`font-medium text-gray-600 ${isCompact ? 'text-xs' : 'text-sm'} mb-1`}>Income</p>
            <p className={`font-bold text-green-900 ${isCompact ? 'text-sm' : 'text-lg'}`}>{formatCurrency(monthIncome)}</p>
          </div>
        </div>

        <div className={`bg-red-50 rounded-lg ${isCompact ? 'p-3' : 'p-4'}`}>
          <div className="flex flex-col">
            <p className={`font-medium text-gray-600 ${isCompact ? 'text-xs' : 'text-sm'} mb-1`}>Expense</p>
            <p className={`font-bold text-red-900 ${isCompact ? 'text-sm' : 'text-lg'}`}>{formatCurrency(monthExpense)}</p>
          </div>
        </div>

        <div className={`rounded-lg ${isCompact ? 'p-3' : 'p-4'} ${balance >= 0 ? 'bg-blue-50' : 'bg-orange-50'}`}>
          <div className="flex flex-col">
            <p className={`font-medium text-gray-600 ${isCompact ? 'text-xs' : 'text-sm'} mb-1`}>Balance</p>
            <p className={`font-bold ${isCompact ? 'text-sm' : 'text-lg'} ${balance >= 0 ? 'text-blue-900' : 'text-orange-900'}`}>
              {formatCurrency(balance)}
            </p>
          </div>
        </div>

        {/* Row 2: Total Budgeted | Budget Status | Variance */}
        <div className={`bg-gray-50 rounded-lg ${isCompact ? 'p-3' : 'p-4'}`}>
          <div className="flex flex-col">
            <p className={`font-medium text-gray-600 ${isCompact ? 'text-xs' : 'text-sm'} mb-1`}>Total Budgeted</p>
            <p className={`font-bold text-gray-900 ${isCompact ? 'text-sm' : 'text-lg'}`}>{formatCurrency(budgetAnalysis.totalBudgeted)}</p>
          </div>
        </div>

        <div className={`rounded-lg ${isCompact ? 'p-3' : 'p-4'} ${
          budgetUtilization <= 80 ? 'bg-green-50' : 
          budgetUtilization <= 100 ? 'bg-yellow-50' : 'bg-red-50'
        }`}>
          <div className="flex flex-col">
            <p className={`font-medium text-gray-600 ${isCompact ? 'text-xs' : 'text-sm'} mb-1`}>Budget Status</p>
            <p className={`font-bold ${isCompact ? 'text-sm' : 'text-lg'} ${
              budgetUtilization <= 80 ? 'text-green-900' : 
              budgetUtilization <= 100 ? 'text-yellow-900' : 'text-red-900'
            }`}>
              {(() => {
                const categoriesOverBudget = budgetAnalysis.categoryComparisons.filter(c => c.status === 'over').length;
                if (categoriesOverBudget === 0) {
                  return `On Track (${budgetUtilization.toFixed(1)}%)`;
                } else {
                  return `${categoriesOverBudget} ${categoriesOverBudget === 1 ? 'Category' : 'Categories'} Over (${budgetUtilization.toFixed(1)}%)`;
                }
              })()}
            </p>
          </div>
        </div>

        <div className={`rounded-lg ${isCompact ? 'p-3' : 'p-4'} ${budgetAnalysis.totalVariance >= 0 ? 'bg-red-50' : 'bg-green-50'}`}>
          <div className="flex flex-col">
            <p className={`font-medium text-gray-600 ${isCompact ? 'text-xs' : 'text-sm'} mb-1`}>Variance</p>
            <p className={`font-bold ${isCompact ? 'text-sm' : 'text-lg'} ${budgetAnalysis.totalVariance >= 0 ? 'text-red-900' : 'text-green-900'}`}>
              {budgetAnalysis.totalVariance >= 0 ? '+' : ''}{formatCurrency(budgetAnalysis.totalVariance)}
            </p>
          </div>
        </div>
      </div>

      {/* Budget Progress Bar */}
      <div className={isCompact ? 'mb-4' : 'mb-6'}>
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <span className={`font-medium text-gray-700 ${isCompact ? 'text-xs' : 'text-sm'}`}>Overall Budget Progress</span>
            <button
              onClick={() => setShowProgressHelp(true)}
              className="text-gray-400 hover:text-blue-600 transition-colors"
              title="Learn how this is calculated"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
          </div>
          <span className={`text-gray-600 ${isCompact ? 'text-xs' : 'text-sm'}`}>{budgetUtilization.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all duration-300 ${
              budgetUtilization <= 80 ? 'bg-green-500' : 
              budgetUtilization <= 100 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(budgetUtilization, 100)}%` }}
          ></div>
        </div>
      </div>

      {/* Active Alerts */}
      {budgetAnalysis.alerts.length > 0 && (
        <div className={isCompact ? 'mb-4' : 'mb-6'}>
          <h3 className={`font-medium text-gray-900 mb-3 ${isCompact ? 'text-sm' : 'text-lg'}`}>Budget Alerts</h3>
          <div className="space-y-2">
            {budgetAnalysis.alerts.slice(0, isCompact ? 2 : 3).map((alert) => (
              <div 
                key={alert.id}
                className={`${isCompact ? 'p-2' : 'p-3'} rounded-lg border-s-4 ${
                  alert.severity === 'high' ? 'bg-red-50 border-red-400' :
                  alert.severity === 'medium' ? 'bg-yellow-50 border-yellow-400' :
                  'bg-blue-50 border-blue-400'
                }`}
              >
                <div className="flex">
                  <AlertTriangle className={`h-4 w-4 mt-0.5 me-2 ${
                    alert.severity === 'high' ? 'text-red-500' :
                    alert.severity === 'medium' ? 'text-yellow-500' :
                    'text-blue-500'
                  }`} />
                  <div>
                    <p className={`font-medium text-gray-900 ${isCompact ? 'text-xs' : 'text-sm'}`}>{alert.category}</p>
                    <p className={`text-gray-600 ${isCompact ? 'text-xs' : 'text-sm'}`}>{alert.message}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detailed Category Breakdown */}
      {showDetails && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Category Breakdown</h3>
          <div className="space-y-3">
            {budgetAnalysis.categoryComparisons
              .filter(comp => comp.budgeted > 0) // Only show categories with budgets
              .sort((a, b) => b.budgeted - a.budgeted) // Sort by budget amount
              .map((comparison) => {
                const utilization = comparison.budgeted > 0 ? (comparison.actual / comparison.budgeted) * 100 : 0;
                
                return (
                  <div key={comparison.category} className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center">
                        {getStatusIcon(comparison.status)}
                        <span className="ms-2 font-medium text-gray-900">{comparison.category}</span>
                      </div>
                      <div className="text-end">
                        <div className={`text-sm font-medium ${getStatusColor(comparison.status)}`}>
                          {formatCurrency(comparison.actual)} / {formatCurrency(comparison.budgeted)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {comparison.variance >= 0 ? '+' : ''}{formatCurrency(comparison.variance)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${
                          utilization <= 80 ? 'bg-green-500' : 
                          utilization <= 100 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(utilization, 100)}%` }}
                      ></div>
                    </div>
                    
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-xs text-gray-500">{utilization.toFixed(1)}% used</span>
                      {utilization > 100 && (
                        <span className="text-xs text-red-600 font-medium">
                          Over budget by {formatCurrency(comparison.variance)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Savings Rate */}
      {!isCompact && (
        <div className="mt-6 pt-4 border-t">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">Savings Rate</span>
            <span className={`text-sm font-bold ${
              budgetAnalysis.savingsRate >= 20 ? 'text-green-600' :
              budgetAnalysis.savingsRate >= 10 ? 'text-yellow-600' :
              'text-red-600'
            }`}>
              {budgetAnalysis.savingsRate.toFixed(1)}%
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Income to Expense Ratio: {budgetAnalysis.incomeExpenseRatio.toFixed(2)}
          </div>
        </div>
      )}

      {/* Budget Progress Help Modal */}
      {showProgressHelp && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowProgressHelp(false)}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Understanding Budget Progress</h2>
                <p className="text-sm text-gray-500 mt-1">How we calculate your progress</p>
              </div>
              <button
                onClick={() => setShowProgressHelp(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Calculation Formula */}
              <div className="bg-blue-50 border-s-4 border-blue-500 p-4 rounded">
                <h3 className="font-semibold text-blue-900 mb-2">📊 The Formula</h3>
                <div className="font-mono text-sm bg-white p-3 rounded border border-blue-200">
                  Progress = (Total Spent / Total Budgeted) × 100%
                </div>
              </div>

              {/* Current Values */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Total Budgeted (Active Categories)</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(budgetAnalysis.totalBudgeted)}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Total Spent (Active Categories)</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(budgetAnalysis.totalSpent)}</p>
                </div>
              </div>

              {/* Example Calculation */}
              <div className="bg-green-50 border-s-4 border-green-500 p-4 rounded">
                <h3 className="font-semibold text-green-900 mb-2">🧮 Your Current Calculation</h3>
                <div className="text-sm space-y-2">
                  <p className="text-gray-700">
                    Progress = ({formatCurrency(budgetAnalysis.totalSpent)} / {formatCurrency(budgetAnalysis.totalBudgeted)}) × 100%
                  </p>
                  <p className="text-lg font-bold text-green-900">
                    = {budgetUtilization.toFixed(1)}%
                  </p>
                </div>
              </div>

              {/* What It Means */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">💡 What This Means</h3>
                <div className="space-y-2 text-sm text-gray-700">
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-1.5 flex-shrink-0"></div>
                    <p><strong className="text-green-700">0-80%:</strong> You're doing great! Well within budget.</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full mt-1.5 flex-shrink-0"></div>
                    <p><strong className="text-yellow-700">80-100%:</strong> Watch your spending - approaching your limit.</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full mt-1.5 flex-shrink-0"></div>
                    <p><strong className="text-red-700">Over 100%:</strong> You've exceeded your budget - time to review!</p>
                  </div>
                </div>
              </div>

              {/* Important Notes */}
              <div className="bg-yellow-50 border-s-4 border-yellow-500 p-4 rounded">
                <h3 className="font-semibold text-yellow-900 mb-2">⚠️ Important Considerations</h3>
                <ul className="text-sm text-gray-700 space-y-2 list-disc list-inside">
                  <li><strong>Only Active Categories Count:</strong> Inactive categories are excluded from both budget and spending totals.</li>
                  <li><strong>Month-to-Date:</strong> This shows your progress for the current/selected month only.</li>
                  <li><strong>Real-Time Updates:</strong> Progress updates as you add transactions or modify budgets.</li>
                  <li><strong>Category-Specific:</strong> Check individual category details below for specific breakdowns.</li>
                </ul>
              </div>

              {/* Tips */}
              <div className="bg-purple-50 border-s-4 border-purple-500 p-4 rounded">
                <h3 className="font-semibold text-purple-900 mb-2">💰 Pro Tips</h3>
                <ul className="text-sm text-gray-700 space-y-2 list-disc list-inside">
                  <li>Deactivate categories you're not tracking this month to keep progress focused</li>
                  <li>Aim to stay under 80% by month-end for a healthy financial buffer</li>
                  <li>Review category details regularly to catch overspending early</li>
                  <li>Adjust budgets mid-month if your circumstances change</li>
                </ul>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4 flex justify-end">
              <button
                onClick={() => setShowProgressHelp(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Got It!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BudgetOverview;
