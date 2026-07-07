// DashboardEmptyState — shown when no transactions exist for the current month.
// Features day-of-month aware messaging and previous month performance summary.

import React, { useMemo } from 'react';
import { Plus, TrendingUp, TrendingDown, CheckCircle, AlertTriangle, Target, Sparkles, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Transaction } from '../../types';
import type { PersonalBudget } from '../../types/budget';
import type { BudgetConfiguration } from '../../types';
import { budgetService } from '../../services/budgetService';
import { getUserLocale } from '../../utils/locale';

interface DashboardEmptyStateProps {
  monthDate: Date;
  allTransactions: Transaction[];
  personalBudget: PersonalBudget | null | undefined;
  formatCurrency: (n: number) => string;
  householdName?: string;
}

interface MonthMessage {
  emoji: string;
  title: string;
  subtitle: string;
}

function getMonthMessage(day: number, monthName: string): MonthMessage {
  if (day <= 3)
    return {
      emoji: '🌱',
      title: `Fresh start to ${monthName}!`,
      subtitle: 'Set the tone early — log your first transaction of the month.',
    };
  if (day <= 7)
    return {
      emoji: '📝',
      title: `Week 1 of ${monthName}`,
      subtitle: "A great time to capture this week's spending before it slips away.",
    };
  if (day <= 14)
    return {
      emoji: '⏰',
      title: `Two weeks into ${monthName}`,
      subtitle: "You're halfway through the first half. Start tracking now for the full picture.",
    };
  if (day <= 20)
    return {
      emoji: '📊',
      title: `Halfway through ${monthName}`,
      subtitle: 'Plenty of month left — catching up now still gives you a great view.',
    };
  if (day <= 25)
    return {
      emoji: '🏃',
      title: `Home stretch — ${monthName} is winding down`,
      subtitle: "Don't let the last stretch go untracked.",
    };
  return {
    emoji: '⚡',
    title: `${monthName} is almost over`,
    subtitle: 'Final days — lock in your records before the month closes.',
  };
}

interface PrevMonthSummary {
  monthLabel: string;
  income: number;
  expenses: number;
  balance: number;
  overBudgetCount: number;
  bestCategory: string | null;
  worstCategory: string | null;
}

function computePrevMonthSummary(
  transactions: Transaction[],
  prevDate: Date,
  budgetConfig: BudgetConfiguration | null
): PrevMonthSummary | null {
  const year = prevDate.getFullYear();
  const month = prevDate.getMonth();
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);

  const prevTxns = transactions.filter((t) => {
    const d = new Date(t.date);
    return d >= monthStart && d <= monthEnd;
  });

  if (prevTxns.length === 0) return null;

  const income = prevTxns
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0);
  const expenses = prevTxns
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);
  const balance = income - expenses;

  const monthLabel = prevDate.toLocaleDateString(getUserLocale(), {
    month: 'long',
    year: 'numeric',
  });

  let overBudgetCount = 0;
  let bestCategory: string | null = null;
  let worstCategory: string | null = null;

  if (budgetConfig && Object.keys(budgetConfig.categories).length > 0) {
    const monthName = prevDate.toLocaleDateString('en-US', { month: 'long' });
    try {
      const analysis = budgetService.analyzeBudgetPerformanceWithConfig(
        transactions,
        monthName,
        year,
        budgetConfig
      );
      const comps = analysis.categoryComparisons.filter(
        (c) => c.budgeted > 0 && c.actual > 0
      );
      overBudgetCount = comps.filter((c) => c.status === 'over').length;
      if (comps.length > 0) {
        const sorted = [...comps].sort(
          (a, b) => a.actual / a.budgeted - b.actual / b.budgeted
        );
        bestCategory = sorted[0].category;
        worstCategory = sorted[sorted.length - 1].category;
      }
    } catch {
      // budgetService can throw if config is empty — ignore
    }
  }

  return { monthLabel, income, expenses, balance, overBudgetCount, bestCategory, worstCategory };
}

export const DashboardEmptyState: React.FC<DashboardEmptyStateProps> = ({
  monthDate,
  allTransactions,
  personalBudget,
  formatCurrency,
  householdName,
}) => {
  const navigate = useNavigate();

  const day = monthDate.getDate();
  const monthName = monthDate.toLocaleDateString(getUserLocale(), { month: 'long' });
  const message = useMemo(() => getMonthMessage(day, monthName), [day, monthName]);

  // Previous month data
  const prevDate = useMemo(
    () => new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1),
    [monthDate]
  );

  const budgetConfig: BudgetConfiguration | null = useMemo(() => {
    if (!personalBudget) return null;
    return {
      version: '2.0.0',
      lastUpdated: personalBudget.updated_at,
      categories: { ...personalBudget.categories },
      globalSettings: personalBudget.global_settings,
    };
  }, [personalBudget]);

  const prevSummary = useMemo(
    () => computePrevMonthSummary(allTransactions, prevDate, budgetConfig),
    [allTransactions, prevDate, budgetConfig]
  );

  const openAddTransaction = () => {
    window.dispatchEvent(new CustomEvent('open-add-transaction'));
  };

  return (
    <div className="space-y-5">
      {/* Hero message card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border-2 border-dashed border-purple-300 dark:border-purple-700 p-8 text-center">
        <div className="max-w-lg mx-auto">
          <div className="text-5xl mb-4">{message.emoji}</div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            {message.title}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6 text-base">{message.subtitle}</p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={openAddTransaction}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium shadow-md"
            >
              <Plus className="h-4 w-4" />
              Add Transaction
            </button>
            <button
              onClick={() => navigate('/?tab=transactions')}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors font-medium"
            >
              <Upload className="h-4 w-4" />
              Import Transactions
            </button>
            {!personalBudget && (
              <button
                onClick={() => navigate('/?tab=budget')}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors font-medium"
              >
                <Sparkles className="h-4 w-4" />
                Set Up Budget
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Previous month performance — if data exists */}
      {prevSummary && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Last month — {prevSummary.monthLabel}
            </h4>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-3 gap-3 mb-4">
              {/* Income */}
              <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400 mx-auto mb-1" />
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Income</p>
                <p className="text-base font-bold text-green-700 dark:text-green-400 truncate">
                  {formatCurrency(prevSummary.income)}
                </p>
              </div>
              {/* Expenses */}
              <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <TrendingDown className="h-4 w-4 text-red-500 dark:text-red-400 mx-auto mb-1" />
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Expenses</p>
                <p className="text-base font-bold text-red-600 dark:text-red-400 truncate">
                  {formatCurrency(prevSummary.expenses)}
                </p>
              </div>
              {/* Balance */}
              <div
                className={`text-center p-3 rounded-lg ${
                  prevSummary.balance >= 0
                    ? 'bg-blue-50 dark:bg-blue-900/20'
                    : 'bg-orange-50 dark:bg-orange-900/20'
                }`}
              >
                {prevSummary.balance >= 0 ? (
                  <CheckCircle className="h-4 w-4 text-blue-500 mx-auto mb-1" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-orange-500 mx-auto mb-1" />
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Balance</p>
                <p
                  className={`text-base font-bold truncate ${
                    prevSummary.balance >= 0
                      ? 'text-blue-700 dark:text-blue-400'
                      : 'text-orange-600 dark:text-orange-400'
                  }`}
                >
                  {formatCurrency(Math.abs(prevSummary.balance))}
                </p>
              </div>
            </div>

            {/* Category highlights */}
            {(prevSummary.bestCategory || prevSummary.worstCategory || prevSummary.overBudgetCount > 0) && (
              <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
                {prevSummary.overBudgetCount > 0 && (
                  <span className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-full border border-red-200 dark:border-red-800">
                    <AlertTriangle className="h-3 w-3" />
                    {prevSummary.overBudgetCount} categor{prevSummary.overBudgetCount === 1 ? 'y' : 'ies'} over budget
                  </span>
                )}
                {prevSummary.bestCategory && (
                  <span className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-full border border-green-200 dark:border-green-800">
                    <CheckCircle className="h-3 w-3" />
                    Best: {prevSummary.bestCategory}
                  </span>
                )}
                {prevSummary.worstCategory && prevSummary.worstCategory !== prevSummary.bestCategory && (
                  <span className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 rounded-full border border-yellow-200 dark:border-yellow-800">
                    <Target className="h-3 w-3" />
                    Watch: {prevSummary.worstCategory}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick tips — if no previous data either */}
      {!prevSummary && (
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800 p-5">
          <p className="text-sm font-semibold text-purple-800 dark:text-purple-200 mb-2">
            💡 Getting started
          </p>
          <ul className="text-sm text-purple-700 dark:text-purple-300 space-y-1.5 list-disc list-inside">
            <li>Start with your main income source for the month</li>
            <li>
              Add your regular fixed expenses (rent, subscriptions, utilities)
            </li>
            {!personalBudget && (
              <li>
                Create a budget to compare your spending against monthly targets
              </li>
            )}
            <li>
              Use{' '}
              <button
                onClick={() => navigate('/?tab=transactions')}
                className="underline hover:text-purple-900 dark:hover:text-purple-100"
              >
                Import
              </button>{' '}
              to bulk-load from a bank export
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};
