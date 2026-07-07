// DashboardTileLayout — compact, centred, 2-column tile layout.
// Left: ExpenseChart (pie + transaction drill-down when category selected)
// Right: Sorted category budget tiles with red-dot alerts and fixed-height scroll
// Top: 4 stat chips (Income, Expenses, Balance, Budget%)

import React, { useMemo, useState } from 'react';
import {
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Calendar,
  ArrowRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMonthlyBudget } from '../../hooks/useBudgets';
import { budgetService } from '../../services/budgetService';
import { ExpenseChart } from './ExpenseChart';
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
  onEditTransaction: (t: Transaction) => void;
  onViewAllTransactions: (category: string) => void;
  selectedCategory?: string | null;
}

const progressColor = (pct: number) =>
  pct >= 100 ? 'bg-red-500' : pct >= 75 ? 'bg-yellow-500' : 'bg-green-500';

export const DashboardTileLayout: React.FC<DashboardTileLayoutProps> = ({
  monthDate,
  transactions,
  categoryData,
  personalBudget,
  formatCurrency,
  onCategoryClick,
  onEditTransaction,
  onViewAllTransactions,
  selectedCategory,
}) => {
  const navigate = useNavigate();

  const selectedYear = monthDate.getFullYear();
  const selectedMonthNum = monthDate.getMonth() + 1;
  const { data: monthlyBudget } = useMonthlyBudget(selectedYear, selectedMonthNum);

  const year = monthDate.getFullYear();
  const monthName = monthDate.toLocaleDateString('en-US', { month: 'long' });

  // Track which over-budget categories have been clicked (dot dismissed)
  const [inspectedCategories, setInspectedCategories] = useState<Set<string>>(new Set());

  // Local selected category (drives pie + tile highlight); initialised from prop
  const [localSelected, setLocalSelected] = useState<string | null>(selectedCategory ?? null);

  const handleTileClick = (categoryName: string) => {
    setInspectedCategories((prev) => new Set([...prev, categoryName]));
    const next = localSelected === categoryName ? null : categoryName;
    setLocalSelected(next);
    onCategoryClick(categoryName);
  };

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
    () =>
      budgetService.analyzeBudgetPerformanceWithConfig(
        transactions,
        monthName,
        year,
        budgetConfig
      ),
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

  // Sort: exceeded → descending utilisation % → empty last
  const sortedCategories = useMemo(
    () =>
      [...analysis.categoryComparisons]
        .filter((c) => c.budgeted > 0)
        .sort((a, b) => {
          const pctA = a.budgeted > 0 ? a.actual / a.budgeted : 0;
          const pctB = b.budgeted > 0 ? b.actual / b.budgeted : 0;
          const aOver = a.status === 'over';
          const bOver = b.status === 'over';
          if (aOver !== bOver) return aOver ? -1 : 1;
          const aEmpty = a.actual === 0;
          const bEmpty = b.actual === 0;
          if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;
          return pctB - pctA;
        }),
    [analysis.categoryComparisons]
  );

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* ── Top stat row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(
          [
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
          ] as const
        ).map(({ label, value, sub, color, bg, Icon }) => (
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
        {/* Left (60%): Expense pie + transaction drill-down */}
        <div className="md:col-span-3">
          <ExpenseChart
            categoryData={categoryData}
            transactions={transactions}
            personalBudget={personalBudget}
            formatCurrency={formatCurrency}
            selectedCategory={localSelected}
            onEditTransaction={onEditTransaction}
            onViewAllTransactions={onViewAllTransactions}
          />
        </div>

        {/* Right (40%): Category budget tiles */}
        <div className="md:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              Categories
            </h3>
            <button
              onClick={() => navigate('/?tab=budget')}
              className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
            >
              Manage <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          {sortedCategories.length === 0 ? (
            <div className="p-6 text-center text-gray-400 text-sm flex-1">
              <p>No budget categories configured</p>
              <button
                onClick={() => navigate('/?tab=budget')}
                className="mt-2 text-purple-600 dark:text-purple-400 underline text-xs"
              >
                Set up your budget →
              </button>
            </div>
          ) : (
            /* Fixed height grid — scrolls once content overflows */
            <div className="p-2 grid grid-cols-2 gap-2 max-h-[340px] overflow-y-auto">
              {sortedCategories.map((comp) => {
                const pct =
                  comp.budgeted > 0
                    ? Math.min(100, (comp.actual / comp.budgeted) * 100)
                    : 0;
                const catColor = personalBudget?.categories[comp.category]?.color;
                const isOver = comp.status === 'over';
                const showDot = isOver && !inspectedCategories.has(comp.category);
                const isSelected = localSelected === comp.category;

                return (
                  <button
                    key={comp.category}
                    onClick={() => handleTileClick(comp.category)}
                    className={`relative text-left p-3 rounded-lg border transition-all ${
                      isSelected
                        ? 'border-purple-400 dark:border-purple-500 bg-purple-50 dark:bg-purple-900/20 shadow-sm'
                        : 'border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/40 hover:border-purple-300 dark:hover:border-purple-600 hover:shadow-sm'
                    }`}
                  >
                    {/* Red dot — over budget, not yet inspected */}
                    {showDot && (
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-gray-700" />
                    )}

                    <div className="flex items-center gap-1.5 mb-2">
                      {catColor && (
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: catColor }}
                        />
                      )}
                      <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate leading-tight">
                        {comp.category}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between mb-1.5">
                      <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                        {formatCurrency(comp.actual)}
                      </span>
                      <span className="text-xs text-gray-400 ml-1">
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

          {/* Overall usage bar — footer */}
          {analysis.totalBudgeted > 0 && (
            <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 flex-shrink-0">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs text-gray-500 dark:text-gray-400">Overall</span>
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  {Math.round(usagePct)}%
                </span>
              </div>
              <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${progressColor(usagePct)}`}
                  style={{ width: `${usagePct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

