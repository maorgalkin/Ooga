// DashboardTileLayout — single-column tiled layout:
// 1. Stat chips (6+, responsive row)
// 2. Category tiles (2-per-row grid, fixed-height scroll)
// 3. ExpenseChart (pie centred; slides left + transaction list on category click)

import React, { useMemo, useState } from 'react';
import {
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Calendar,
  DollarSign,
  ArrowDownUp,
  Gauge,
} from 'lucide-react';
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
  const selectedYear = monthDate.getFullYear();
  const selectedMonthNum = monthDate.getMonth() + 1;
  const { data: monthlyBudget } = useMonthlyBudget(selectedYear, selectedMonthNum);

  const year = monthDate.getFullYear();
  const monthName = monthDate.toLocaleDateString('en-US', { month: 'long' });

  const [inspectedCategories, setInspectedCategories] = useState<Set<string>>(new Set());
  const [localSelected, setLocalSelected] = useState<string | null>(selectedCategory ?? null);

  const handleTileClick = (categoryName: string) => {
    setInspectedCategories((prev) => new Set([...prev, categoryName]));
    setLocalSelected((prev) => (prev === categoryName ? null : categoryName));
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
  const variance = analysis.totalBudgeted - analysis.totalSpent; // positive = under budget
  const overBudgetCount = analysis.categoryComparisons.filter((c) => c.status === 'over').length;

  // ── Stat chips ─────────────────────────────────────────────────────────────
  type Chip = {
    label: string;
    value: string;
    sub?: string;
    color: string;
    bg: string;
    Icon: React.ElementType;
  };

  const chips: Chip[] = [
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
      label: 'Budgeted',
      value: formatCurrency(analysis.totalBudgeted),
      sub: `${analysis.categoryComparisons.filter((c) => c.budgeted > 0).length} categories`,
      color: 'text-gray-700 dark:text-gray-300',
      bg: 'bg-gray-50 dark:bg-gray-700/40',
      Icon: DollarSign,
    },
    {
      label: 'Used',
      value: `${Math.round(usagePct)}%`,
      sub: 'of budget',
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
      Icon: Gauge,
    },
    {
      label: 'Variance',
      value: formatCurrency(Math.abs(variance)),
      sub: variance >= 0 ? 'under budget' : 'over budget',
      color:
        variance >= 0
          ? 'text-green-700 dark:text-green-400'
          : 'text-red-600 dark:text-red-400',
      bg:
        variance >= 0
          ? 'bg-green-50 dark:bg-green-900/20'
          : 'bg-red-50 dark:bg-red-900/20',
      Icon: ArrowDownUp,
    },
  ];

  // Optional 7th chip: over-budget categories
  if (overBudgetCount > 0) {
    chips.push({
      label: 'Over budget',
      value: String(overBudgetCount),
      sub: `categor${overBudgetCount === 1 ? 'y' : 'ies'}`,
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-50 dark:bg-red-900/20',
      Icon: AlertTriangle,
    });
  }

  // Optional 8th chip: budget adjustments pending next month
  const adjustmentsTotal =
    monthlyBudget?.adjustment_count && monthlyBudget.adjustment_count > 0
      ? monthlyBudget.adjustment_count
      : null;
  if (adjustmentsTotal) {
    chips.push({
      label: 'Adjustments',
      value: String(adjustmentsTotal),
      sub: 'next month',
      color: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-50 dark:bg-purple-900/20',
      Icon: Calendar,
    });
  }

  // ── Category tiles ─────────────────────────────────────────────────────────
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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* 1. STAT CHIPS — fills 2→3→6 columns responsively */}
      <div
        className="grid gap-2"
        style={{
          gridTemplateColumns: `repeat(${Math.min(chips.length, 6)}, minmax(0, 1fr))`,
        }}
      >
        {chips.map(({ label, value, sub, color, bg, Icon }) => (
          <div
            key={label}
            className={`rounded-xl p-3 ${bg} border border-white/60 dark:border-gray-700/50`}
          >
            <div className="flex items-center gap-1 mb-1.5">
              <Icon className={`h-3 w-3 ${color} flex-shrink-0`} />
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{label}</p>
            </div>
            <p className={`text-lg font-bold leading-none ${color} truncate`}>{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-1 truncate">{sub}</p>}
          </div>
        ))}
      </div>

      {/* 2. CATEGORY TILES — always 2-per-row, scrollable */}
      {sortedCategories.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-2 gap-2 p-2 max-h-[320px] overflow-y-auto">
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
                    <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">
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
        </div>
      )}

      {/* 3. EXPENSE PIE — centred; slides left when category selected */}
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
  );
};
