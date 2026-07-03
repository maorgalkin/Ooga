// Budget Overview Tab
// Rich summary of the active budget: header, usage stats, per-category deep-dive,
// and budget version history (recent + archived).

import React, { useState, useMemo } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Pencil,
  Repeat,
  CheckCircle,
  XCircle,
  MinusCircle,
  Archive,
  Star,
  Trash2,
  Loader2,
  Clock,
  TrendingDown,
  TrendingUp,
  BarChart2,
  DollarSign,
} from 'lucide-react';
import {
  useActiveBudget,
  useCurrentMonthBudget,
  usePersonalBudgetHistory,
  useSetActiveBudget,
  useDeletePersonalBudget,
} from '../../hooks/useBudgets';
import { useCategories } from '../../hooks/useCategories';
import { useFinance } from '../../context/FinanceContext';
import { EditLimitModal } from '../categories/EditLimitModal';
import { formatCurrencyFromSettings } from '../../utils/formatCurrency';
import { getUserLocale } from '../../utils/locale';
import {
  getHeaderGradient,
  getTextColor,
  getAccentColor,
  getInactiveBg,
  getInactiveBorderColor,
  getIconColor,
  getSubheadingColor,
} from '../../utils/themeColors';
import type { PersonalBudget, CategoryConfig } from '../../types/budget';
import type { Category } from '../../types/category';
import type { Transaction } from '../../types';

const THEME = 'green' as const;

// ── Sub-component: History card ──────────────────────────────────────────────

interface BudgetHistoryCardProps {
  budget: PersonalBudget;
  archived: boolean;
  formatCurrency: (amount: number) => string;
  onSetActive: () => void;
  onDelete: () => void;
  isSettingActive: boolean;
  isDeleting: boolean;
}

const BudgetHistoryCard: React.FC<BudgetHistoryCardProps> = ({
  budget,
  archived,
  formatCurrency,
  onSetActive,
  onDelete,
  isSettingActive,
  isDeleting,
}) => {
  const activeEntries = Object.values(budget.categories).filter(
    (c: CategoryConfig) => c.isActive
  );
  const totalBudget = activeEntries.reduce(
    (s: number, c: CategoryConfig) => s + c.monthlyLimit,
    0
  );

  return (
    <div
      className={`p-3 rounded-lg border bg-white dark:bg-gray-800 transition-opacity ${
        archived
          ? 'border-gray-300 dark:border-gray-600 opacity-70'
          : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate">
              {budget.name}
            </h4>
            <span className="text-xs text-gray-500 dark:text-gray-400">v{budget.version}</span>
            {archived && (
              <span className="flex items-center gap-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded">
                <Archive className="h-3 w-3" />
                Archived
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {activeEntries.length} {activeEntries.length === 1 ? 'category' : 'categories'} •{' '}
            {formatCurrency(totalBudget)} total
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {new Date(budget.updated_at).toLocaleDateString(getUserLocale(), {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </p>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button
            onClick={onSetActive}
            disabled={isSettingActive}
            className="p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded transition-colors"
            title="Restore this version as active"
          >
            {isSettingActive ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Star className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
            title="Delete this version"
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

export const BudgetOverviewTab: React.FC = () => {
  const { data: activeBudget, isLoading } = useActiveBudget();
  const { data: currentMonthBudget } = useCurrentMonthBudget();
  const { data: budgetHistory = [] } = usePersonalBudgetHistory();
  const { data: categories = [] } = useCategories(false, 'expense');
  const { transactions } = useFinance();
  const setActive = useSetActiveBudget();
  const deleteBudget = useDeletePersonalBudget();

  const now = useMemo(() => new Date(), []);

  const [selectedCategoryName, setSelectedCategoryName] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [showOlderHistory, setShowOlderHistory] = useState(false);

  const formatCurrency = (amount: number) =>
    formatCurrencyFromSettings(amount, activeBudget?.global_settings);

  // Active categories (from personal budget config)
  const activeCategories = useMemo(() => {
    if (!activeBudget) return [] as [string, CategoryConfig][];
    return Object.entries(activeBudget.categories).filter(
      ([, cat]) => cat.isActive
    ) as [string, CategoryConfig][];
  }, [activeBudget]);

  // Default to first active category when none selected
  const effectiveSelectedName = selectedCategoryName ?? activeCategories[0]?.[0] ?? null;

  // Prefer monthly budget limit (mid-month edits) over personal budget limit
  const getEffectiveLimit = (name: string, fallback: number): number =>
    currentMonthBudget?.categories?.[name]?.monthlyLimit ?? fallback;

  // Current month date range (memoized — won't change mid-session)
  const [currentMonthStart, currentMonthEnd] = useMemo(() => {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return [start, end];
  }, [now]);

  // All expense transactions in the current month
  const currentMonthExpenses = useMemo(
    () =>
      transactions.filter((t) => {
        const d = new Date(t.date);
        return d >= currentMonthStart && d <= currentMonthEnd && t.type === 'expense';
      }),
    [transactions, currentMonthStart, currentMonthEnd]
  );

  // Spending totals per category for current month
  const categorySpending = useMemo(() => {
    const spending: Record<string, number> = {};
    currentMonthExpenses.forEach((t) => {
      spending[t.category] = (spending[t.category] || 0) + t.amount;
    });
    return spending;
  }, [currentMonthExpenses]);

  // Overall budget summary
  const totalBudget = useMemo(
    () =>
      activeCategories.reduce(
        (sum, [name, cat]) => sum + getEffectiveLimit(name, cat.monthlyLimit),
        0
      ),
    [activeCategories, currentMonthBudget]
  );

  const totalSpent = useMemo(
    () => activeCategories.reduce((sum, [name]) => sum + (categorySpending[name] || 0), 0),
    [activeCategories, categorySpending]
  );

  const remaining = totalBudget - totalSpent;
  const usagePct = totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0;

  // Per-category detail for the selected category
  const selectedCategoryDetail = useMemo(() => {
    if (!effectiveSelectedName || !activeBudget) return null;
    const config = activeBudget.categories[effectiveSelectedName];
    if (!config) return null;

    const limit = getEffectiveLimit(effectiveSelectedName, config.monthlyLimit);
    const spent = categorySpending[effectiveSelectedName] || 0;
    const pct = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0;

    // Biggest single expense this month
    const catTxns = currentMonthExpenses.filter(
      (t) => t.category === effectiveSelectedName
    );
    const biggestExpense = catTxns.reduce<Transaction | null>(
      (max, t) => (!max || t.amount > max.amount ? t : max),
      null
    );

    // Recurring: descriptions appearing in ≥2 of the last 3 calendar months
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const last3MonthsTxns = transactions.filter((t) => {
      const d = new Date(t.date);
      return d >= threeMonthsAgo && t.type === 'expense' && t.category === effectiveSelectedName;
    });

    const descToMonths: Record<string, Set<string>> = {};
    const descToAmounts: Record<string, number[]> = {};
    last3MonthsTxns.forEach((t) => {
      const desc = t.description?.trim().toLowerCase() ?? '';
      if (!desc) return;
      const monthKey = t.date.slice(0, 7); // "YYYY-MM"
      if (!descToMonths[desc]) descToMonths[desc] = new Set();
      if (!descToAmounts[desc]) descToAmounts[desc] = [];
      descToMonths[desc].add(monthKey);
      descToAmounts[desc].push(t.amount);
    });

    const recurring = Object.entries(descToMonths)
      .filter(([, months]) => months.size >= 2)
      .map(([desc]) => {
        const amounts = descToAmounts[desc];
        const avgAmount = amounts.reduce((s, a) => s + a, 0) / amounts.length;
        // Preserve original casing from a sample transaction
        const originalDesc =
          last3MonthsTxns.find((t) => t.description?.trim().toLowerCase() === desc)
            ?.description ?? desc;
        return { description: originalDesc, avgAmount, monthCount: descToMonths[desc].size };
      })
      .sort((a, b) => b.avgAmount - a.avgAmount)
      .slice(0, 5);

    // Limit-met indicator for last 3 complete months (not counting current)
    const limitHistory: { label: string; spent: number; met: boolean }[] = [];
    for (let i = 3; i >= 1; i--) {
      const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      const label = mStart.toLocaleDateString(getUserLocale(), {
        month: 'short',
        year: '2-digit',
      });
      const mSpent = transactions
        .filter((t) => {
          const d = new Date(t.date);
          return (
            d >= mStart &&
            d <= mEnd &&
            t.type === 'expense' &&
            t.category === effectiveSelectedName
          );
        })
        .reduce((s, t) => s + t.amount, 0);
      limitHistory.push({ label, spent: mSpent, met: limit === 0 || mSpent <= limit });
    }

    return { config, limit, spent, pct, biggestExpense, recurring, limitHistory };
  }, [
    effectiveSelectedName,
    activeBudget,
    currentMonthBudget,
    currentMonthExpenses,
    transactions,
    now,
  ]);

  // History split: non-active budgets sorted newest first (service returns by version desc)
  const nonActiveBudgets = useMemo(
    () => budgetHistory.filter((b) => !b.is_active),
    [budgetHistory]
  );
  const recentHistory = nonActiveBudgets.slice(0, 3);
  const olderHistory = nonActiveBudgets.slice(3);
  const prevYearStart = new Date(now.getFullYear() - 1, 0, 1);
  const isArchived = (b: PersonalBudget) => new Date(b.updated_at) < prevYearStart;

  // ── Progress bar colour helpers ────────────────────────────────────────────
  const progressColor = (pct: number) =>
    pct >= 90 ? 'bg-red-500' : pct >= 75 ? 'bg-yellow-500' : 'bg-green-500';

  // ── Loading / empty guards ─────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-green-500" />
      </div>
    );
  }
  if (!activeBudget) return null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* ── 1. BUDGET HEADER ── */}
      <div className={`${getHeaderGradient(THEME)} rounded-xl p-5 text-white shadow-md`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold leading-tight">{activeBudget.name}</h2>
            <div className="flex items-center gap-3 mt-2">
              <span
                className={`text-sm px-2.5 py-0.5 rounded-full font-medium ${getAccentColor(THEME)} ${getTextColor(THEME)}`}
              >
                v{activeBudget.version}
              </span>
              <span className={`text-sm opacity-80 ${getTextColor(THEME)}`}>
                {activeCategories.length}{' '}
                {activeCategories.length === 1 ? 'category' : 'categories'}
              </span>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className={`text-xs opacity-60 ${getTextColor(THEME)}`}>Last updated</p>
            <p className="text-sm font-medium">
              {new Date(activeBudget.updated_at).toLocaleDateString(getUserLocale(), {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>
      </div>

      {/* ── 2. SUMMARY STATS ── */}
      <div className="grid grid-cols-3 gap-3">
        {(
          [
            {
              label: 'Monthly Budget',
              value: formatCurrency(totalBudget),
              sub: `${activeCategories.length} categories`,
              icon: DollarSign,
              color: 'text-gray-900 dark:text-gray-100',
            },
            {
              label: 'Month Spent',
              value: formatCurrency(totalSpent),
              sub: `${Math.round(usagePct)}% used`,
              icon: TrendingDown,
              color:
                usagePct >= 90
                  ? 'text-red-600 dark:text-red-400'
                  : usagePct >= 75
                  ? 'text-yellow-600 dark:text-yellow-400'
                  : 'text-green-600 dark:text-green-400',
            },
            {
              label: 'Remaining',
              value: formatCurrency(Math.abs(remaining)),
              sub: remaining >= 0 ? 'under budget' : 'over budget',
              icon: remaining >= 0 ? TrendingUp : TrendingDown,
              color:
                remaining >= 0
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400',
            },
          ] as const
        ).map(({ label, value, sub, color }) => (
          <div
            key={label}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4"
          >
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 truncate">{label}</p>
            <p className={`text-xl font-bold truncate ${color}`}>{value}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Overall usage progress bar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 px-5 py-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Overall Usage
          </span>
          <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
            {Math.round(usagePct)}%
          </span>
        </div>
        <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${progressColor(usagePct)}`}
            style={{ width: `${usagePct}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-xs text-gray-400">{formatCurrency(totalSpent)} spent</span>
          <span className="text-xs text-gray-400">{formatCurrency(totalBudget)} budget</span>
        </div>
      </div>

      {/* ── 3. CATEGORY DETAIL BLOCK ── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        {/* Dropdown header */}
        <div className="px-5 pt-4 pb-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <BarChart2 className={`h-4 w-4 ${getIconColor(THEME)} flex-shrink-0`} />
            <div className="flex-1 min-w-0">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Category
              </label>
              <div className="relative">
                <select
                  value={effectiveSelectedName ?? ''}
                  onChange={(e) => setSelectedCategoryName(e.target.value)}
                  className="w-full appearance-none bg-transparent text-base font-semibold text-gray-900 dark:text-gray-100 pr-8 focus:outline-none cursor-pointer"
                >
                  {activeCategories.map(([name]) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
            {effectiveSelectedName && (
              <button
                onClick={() => {
                  const cat = categories.find((c) => c.name === effectiveSelectedName);
                  if (cat) setEditingCategory(cat);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors flex-shrink-0"
              >
                <Pencil className="h-3 w-3" />
                Edit
              </button>
            )}
          </div>
        </div>

        {/* Category detail body */}
        {selectedCategoryDetail ? (
          <div className="p-5 space-y-5">
            {/* Spending vs limit */}
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <div className="flex items-baseline gap-2">
                  {selectedCategoryDetail.config.color && (
                    <span
                      className="inline-block w-3 h-3 rounded-full flex-shrink-0 mb-0.5"
                      style={{ backgroundColor: selectedCategoryDetail.config.color }}
                    />
                  )}
                  <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                    {formatCurrency(selectedCategoryDetail.spent)}
                  </span>
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  of {formatCurrency(selectedCategoryDetail.limit)} limit
                </span>
              </div>
              <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${progressColor(
                    selectedCategoryDetail.pct
                  )}`}
                  style={{ width: `${selectedCategoryDetail.pct}%` }}
                />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-xs text-gray-400">
                  {Math.round(selectedCategoryDetail.pct)}% used
                </span>
                <span className="text-xs text-gray-400">
                  {formatCurrency(
                    Math.max(0, selectedCategoryDetail.limit - selectedCategoryDetail.spent)
                  )}{' '}
                  remaining
                </span>
              </div>
            </div>

            {/* Biggest expense + limit history (2-col on sm+) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Biggest expense */}
              <div
                className={`rounded-xl p-4 ${getInactiveBg(THEME)} border ${getInactiveBorderColor(
                  THEME
                )}`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <TrendingDown className={`h-4 w-4 ${getIconColor(THEME)}`} />
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Biggest Expense
                  </span>
                </div>
                {selectedCategoryDetail.biggestExpense ? (
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate">
                      {selectedCategoryDetail.biggestExpense.description || 'Unnamed'}
                    </p>
                    <p className={`text-2xl font-bold mt-0.5 ${getIconColor(THEME)}`}>
                      {formatCurrency(selectedCategoryDetail.biggestExpense.amount)}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(
                        selectedCategoryDetail.biggestExpense.date
                      ).toLocaleDateString(getUserLocale(), {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">No expenses this month</p>
                )}
              </div>

              {/* Limit met history */}
              <div
                className={`rounded-xl p-4 ${getInactiveBg(THEME)} border ${getInactiveBorderColor(
                  THEME
                )}`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className={`h-4 w-4 ${getIconColor(THEME)}`} />
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Limit Met
                  </span>
                </div>
                {selectedCategoryDetail.limitHistory.some((m) => m.spent > 0) ? (
                  <div className="flex gap-2 justify-around">
                    {selectedCategoryDetail.limitHistory.map(({ label, spent, met }) => (
                      <div key={label} className="flex-1 text-center">
                        <div className="mb-1.5 flex justify-center">
                          {spent === 0 ? (
                            <MinusCircle className="h-6 w-6 text-gray-300 dark:text-gray-600" />
                          ) : met ? (
                            <CheckCircle className="h-6 w-6 text-green-500" />
                          ) : (
                            <XCircle className="h-6 w-6 text-red-400" />
                          )}
                        </div>
                        <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                          {label}
                        </p>
                        {spent > 0 && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {formatCurrency(spent)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">No history yet</p>
                )}
              </div>
            </div>

            {/* Recurring expenses */}
            {selectedCategoryDetail.recurring.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <Repeat className={`h-4 w-4 ${getIconColor(THEME)}`} />
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Recurring (last 3 months)
                  </span>
                </div>
                <div className="space-y-1.5">
                  {selectedCategoryDetail.recurring.map(
                    ({ description, avgAmount, monthCount }) => (
                      <div
                        key={description}
                        className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700"
                      >
                        <span className="text-sm text-gray-800 dark:text-gray-200 truncate capitalize max-w-[55%]">
                          {description}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400">
                            {monthCount}/3 mo
                          </span>
                          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            ~{formatCurrency(avgAmount)}
                          </span>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-400 italic">
            No active categories configured
          </div>
        )}
      </div>

      {/* ── 4. RECENT BUDGET HISTORY ── */}
      {recentHistory.length > 0 && (
        <div>
          <h3
            className={`text-sm font-semibold ${getSubheadingColor(
              THEME
            )} mb-3 flex items-center gap-2`}
          >
            <Clock className="h-4 w-4" />
            Previous Versions
          </h3>
          <div className="space-y-2">
            {recentHistory.map((b) => (
              <BudgetHistoryCard
                key={b.id}
                budget={b}
                archived={isArchived(b)}
                formatCurrency={formatCurrency}
                onSetActive={() =>
                  setActive.mutateAsync(b.id).catch(() => alert('Failed to set active'))
                }
                onDelete={() => {
                  if (confirm('Delete this budget version?')) {
                    deleteBudget.mutateAsync(b.id).catch(() => alert('Failed to delete'));
                  }
                }}
                isSettingActive={setActive.isPending}
                isDeleting={deleteBudget.isPending}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── 5. OLDER / ARCHIVED HISTORY ── */}
      {olderHistory.length > 0 && (
        <div>
          <button
            onClick={() => setShowOlderHistory((v) => !v)}
            className={`flex items-center gap-2 text-sm ${getSubheadingColor(
              THEME
            )} hover:opacity-80 transition-opacity`}
          >
            {showOlderHistory ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            <span>
              {showOlderHistory ? 'Hide' : 'Show'} {olderHistory.length} older version
              {olderHistory.length !== 1 ? 's' : ''}
            </span>
          </button>
          {showOlderHistory && (
            <div className="mt-3 space-y-2">
              {olderHistory.map((b) => (
                <BudgetHistoryCard
                  key={b.id}
                  budget={b}
                  archived={isArchived(b)}
                  formatCurrency={formatCurrency}
                  onSetActive={() =>
                    setActive.mutateAsync(b.id).catch(() => alert('Failed to set active'))
                  }
                  onDelete={() => {
                    if (confirm('Delete this budget version?')) {
                      deleteBudget.mutateAsync(b.id).catch(() => alert('Failed to delete'));
                    }
                  }}
                  isSettingActive={setActive.isPending}
                  isDeleting={deleteBudget.isPending}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Inline edit modal — no tab switch needed */}
      <EditLimitModal
        isOpen={editingCategory !== null}
        category={editingCategory}
        onClose={() => setEditingCategory(null)}
      />
    </div>
  );
};
