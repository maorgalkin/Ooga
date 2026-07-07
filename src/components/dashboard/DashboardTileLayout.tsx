// DashboardTileLayout — compact, centred, 2-column tile layout.
// Acts as an alternative to the full-width BudgetPerformanceCard + ExpenseChart stack.
// Uses max-w-4xl to keep content from stretching too wide on large monitors.

import React, { useMemo, useState } from 'react';
import { CheckCircle, AlertTriangle, Target, ArrowRight, TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useActiveBudget, useCurrentMonthBudget, useMonthlyBudget } from '../../hooks/useBudgets';
import { budgetService } from '../../services/budgetService';
import { getUserLocale } from '../../utils/locale';
import { getPrimaryButtonBg, getPrimaryButtonHoverBg } from '../../utils/themeColors';
import type { BudgetConfiguration, Transaction } from '../../types';
import type { PersonalBudget } from '../../types/budget';

interface CategoryData {
  category: string;
  amount: number;
}

interface DashboardTileLayoutProps {
  monthDate: Date;
  transactions: Transaction[];
  categoryData: CategoryData[];
  personalBudget: PersonalBudget | null | undefined;
  formatCurrency: (amount: number) => string;
  onCategoryClick: (category: string) => void;
}

const THEME = 'purple' as const;

const progressColor = (pct: number) =>
  pct >= 100 ? 'bg-red-500' : pct >= 75 ? 'bg-yellow-500' : 'bg-green-500';

export const DashboardTileLayout: React.FC<DashboardTileLayoutProps> = ({
  monthDate,
  transactions,
  categoryData,
  personalBudget,
  formatCurrency,
  onCategoryClick,
}) => {
  const navigate = useNavigate();

  const selectedYear = monthDate.getFullYear();
  const selectedMonthNum = monthDate.getMonth() + 1;
  const { data: monthlyBudget } = useMonthlyBudget(selectedYear, selectedMonthNum);

  const displayMonthName = monthDate.toLocaleDateString(getUserLocale(), { month: 'long' });
  const year = monthDate.getFullYear();
  const monthName = monthDate.toLocaleDateString('en-US', { month: 'long' });

  const budgetConfig = useMemo((): BudgetConfiguration => {
    if (personalBudget) {
      const categories = monthlyBudget?.categories
        ? { ...monthlyBudget.categories }
        : { ...personalBudget.categories };
      return {
        version: '2.0.0',
        lastUpdated: monthlyBudget?.updated_at || personalBudget.updated_at,
        categories,
        globalSettings: personalBudget.global_settings,
      };
    }
    return {
      version: '2.0.0',
      lastUpdated: new Date().toISOString(),
      categories: {},
      globalSettings: { currency: 'ILS', warningNotifications: true, emailAlerts: false },
    };
  }, [personalBudget, monthlyBudget]);

  const analysis = useMemo(
    () => budgetService.analyzeBudgetPerformanceWithConfig(transactions, monthName, year, budgetConfig),
    [transactions, monthName, year, budgetConfig]
  );

  const monthIncome = useMemo(
    () =>
      transactions
        .filter((t) => {
          const d = new Date(t.date);
          return (
            d.getMonth() === monthDate.getMonth() &&
            d.getFullYear() === year &&
            t.type === 'income'
          );
        })
        .reduce((s, t) => s + t.amount, 0),
    [transactions, monthDate, year]
  );

  const balance = monthIncome - analysis.totalSpent;
  const usagePct =
    analysis.totalBudgeted > 0
      ? Math.min(100, (analysis.totalSpent / analysis.totalBudgeted) * 100)
      : 0;

  const activeCategories = analysis.categoryComparisons
    .filter((c) => c.budgeted > 0)
    .sort((a, b) => b.budgeted - a.budgeted);

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* ── Top stat row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: 'Income',
            value: formatCurrency(monthIncome),
            color: 'text-green-700 dark:text-green-400',
            bg: 'bg-green-50 dark:bg-green-900/20',
            Icon: TrendingUp,
          },
          {
            label: 'Expenses',
            value: formatCurrency(analysis.totalSpent),
            color: 'text-red-600 dark:text-red-400',
            bg: 'bg-red-50 dark:bg-red-900/20',
            Icon: TrendingDown,
          },
          {
            label: 'Balance',
            value: formatCurrency(Math.abs(balance)),
            sub: balance >= 0 ? '↑ surplus' : '↓ deficit',
            color:
              balance >= 0
                ? 'text-blue-700 dark:text-blue-400'
                : 'text-orange-600 dark:text-orange-400',
            bg:
              balance >= 0
                ? 'bg-blue-50 dark:bg-blue-900/20'
                : 'bg-orange-50 dark:bg-orange-900/20',
            Icon: balance >= 0 ? CheckCircle : AlertTriangle,
          },
          {
            label: 'Budget used',
            value: `${Math.round(usagePct)}%`,
            sub: formatCurrency(analysis.totalBudgeted) + ' total',
            color:
              usagePct >= 100
                ? 'text-red-600 dark:text-red-400'
                : usagePct >= 75
                ? 'text-yellow-600 dark:text-yellow-400'
                : 'text-purple-700 dark:text-purple-400',
            bg:
              usagePct >= 100
                ? 'bg-red-50 dark:bg-red-900/20'
                : usagePct >= 75
                ? 'bg-yellow-50 dark:bg-yellow-900/20'
                : 'bg-purple-50 dark:bg-purple-900/20',
            Icon: Calendar,
          },
        ].map(({ label, value, sub, color, bg, Icon }) => (
          <div
            key={label}
            className={`rounded-xl p-4 ${bg} border border-white/60 dark:border-gray-700/50`}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <Icon className={`h-3.5 w-3.5 ${color}`} />
              <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
            </div>
            <p className={`text-xl font-bold ${color}`}>{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
          </div>
        ))}
      </div>

      {/* ── Main 2-column content ── */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* Left: Category budget tiles */}
        <div className="md:col-span-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              {displayMonthName} · Categories
            </h3>
            <button
              onClick={() => navigate('/?tab=budget')}
              className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
            >
              Budget <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          {activeCategories.length === 0 ? (
            <div className="p-6 text-center text-gray-400 text-sm">
              <p>No budget categories configured</p>
              <button
                onClick={() => navigate('/?tab=budget')}
                className="mt-2 text-purple-600 dark:text-purple-400 underline text-xs"
              >
                Set up your budget →
              </button>
            </div>
          ) : (
            <div className="p-3 grid grid-cols-2 gap-2">
              {activeCategories.map((comp) => {
                const pct =
                  comp.budgeted > 0
                    ? Math.min(100, (comp.actual / comp.budgeted) * 100)
                    : 0;
                const catColor =
                  personalBudget?.categories[comp.category]?.color;
                return (
                  <button
                    key={comp.category}
                    onClick={() => onCategoryClick(comp.category)}
                    className="text-left p-3 rounded-lg border border-gray-100 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600 hover:shadow-sm transition-all bg-gray-50 dark:bg-gray-700/40 group"
                  >
                    <div className="flex items-center gap-1.5 mb-2">
                      {catColor && (
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: catColor }}
                        />
                      )}
                      <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate group-hover:text-purple-700 dark:group-hover:text-purple-300">
                        {comp.category}
                      </span>
                      {comp.status === 'over' && (
                        <AlertTriangle className="h-3 w-3 text-red-500 flex-shrink-0 ml-auto" />
                      )}
                    </div>
                    <div className="flex items-baseline justify-between mb-1.5">
                      <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                        {formatCurrency(comp.actual)}
                      </span>
                      <span className="text-xs text-gray-400">
                        / {formatCurrency(comp.budgeted)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${progressColor(pct)}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{Math.round(pct)}%</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Top expenses summary */}
        <div className="md:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              Top Expenses
            </h3>
          </div>
          <div className="p-3">
            {categoryData.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4 italic">
                No expenses yet
              </p>
            ) : (
              <div className="space-y-2">
                {[...categoryData]
                  .sort((a, b) => b.amount - a.amount)
                  .slice(0, 6)
                  .map(({ category, amount }) => {
                    const catColor = personalBudget?.categories[category]?.color;
                    const budget = analysis.categoryComparisons.find(
                      (c) => c.category === category
                    )?.budgeted;
                    const pct = budget && budget > 0 ? Math.min(100, (amount / budget) * 100) : null;
                    return (
                      <button
                        key={category}
                        onClick={() => onCategoryClick(category)}
                        className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: catColor || '#6b7280' }}
                        />
                        <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">
                          {category}
                        </span>
                        <div className="text-right">
                          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {formatCurrency(amount)}
                          </span>
                          {pct !== null && (
                            <p
                              className={`text-xs ${
                                pct >= 100
                                  ? 'text-red-500'
                                  : pct >= 75
                                  ? 'text-yellow-500'
                                  : 'text-green-500'
                              }`}
                            >
                              {Math.round(pct)}%
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                {categoryData.length > 6 && (
                  <p className="text-xs text-gray-400 text-center pt-1">
                    +{categoryData.length - 6} more categories
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Budget usage bar */}
          {analysis.totalBudgeted > 0 && (
            <div className="px-4 pb-4 pt-1 border-t border-gray-100 dark:border-gray-700 mt-1">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs text-gray-500 dark:text-gray-400">Overall</span>
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  {Math.round(usagePct)}%
                </span>
              </div>
              <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${progressColor(usagePct)}`}
                  style={{ width: `${usagePct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => navigate('/?tab=budget')}
          className={`flex items-center gap-2 px-4 py-2 text-white text-sm rounded-lg ${getPrimaryButtonBg(THEME)} ${getPrimaryButtonHoverBg(THEME)} transition-colors`}
        >
          Manage Budget
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
