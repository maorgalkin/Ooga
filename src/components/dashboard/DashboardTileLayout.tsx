// DashboardTileLayout
//
// sm/md → stacked: chips (row) · categories · pie
// lg+   → [categories + pie] LEFT  |  [chips 2-col sticky] RIGHT
//
// Fuse: desktop category click (with transactions) collapses category grid,
//       expands pie. Block-level X + click-away restore.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle, AlertTriangle, TrendingUp, TrendingDown,
  Calendar, DollarSign, ArrowDownUp, Gauge, X, Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useMonthlyBudget } from '../../hooks/useBudgets';
import { budgetService } from '../../services/budgetService';
import { ExpenseChart } from './ExpenseChart';
import type { BudgetConfiguration, Transaction } from '../../types';
import type { PersonalBudget } from '../../types/budget';

interface CategoryData { category: string; amount: number }

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
  monthDate, transactions, categoryData, personalBudget,
  formatCurrency, onCategoryClick, onEditTransaction, onViewAllTransactions, selectedCategory,
}) => {
  const navigate = useNavigate();

  const { data: monthlyBudget } = useMonthlyBudget(
    monthDate.getFullYear(), monthDate.getMonth() + 1
  );

  const year = monthDate.getFullYear();
  const monthName = monthDate.toLocaleDateString('en-US', { month: 'long' });

  const [inspectedCategories, setInspectedCategories] = useState<Set<string>>(new Set());
  const [localSelected, setLocalSelected] = useState<string | null>(selectedCategory ?? null);
  const [isFused, setIsFused] = useState(false);
  // 'all' | 'over' — filter categories by budget status
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'over'>('all');
  const [showEncouragement, setShowEncouragement] = useState(false);

  // Scroll fade indicator refs/state
  const catGridRef = useRef<HTMLDivElement>(null);
  const [catScrollable, setCatScrollable] = useState(false);
  const [catAtBottom, setCatAtBottom] = useState(false);

  // Click-away ref for the expenses card
  const expensesCardRef = useRef<HTMLDivElement>(null);

  // ── Scroll fade tracking ───────────────────────────────────────────────────
  useEffect(() => {
    const el = catGridRef.current;
    if (!el) return;
    const check = () => {
      const scrollable = el.scrollHeight > el.clientHeight + 2;
      setCatScrollable(scrollable);
      setCatAtBottom(!scrollable || el.scrollTop + el.clientHeight >= el.scrollHeight - 6);
    };
    check();
    el.addEventListener('scroll', check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', check); ro.disconnect(); };
  }, [categoryFilter]); // re-check when filter changes

  // ── Click-away when fused ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isFused) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (expensesCardRef.current && !expensesCardRef.current.contains(e.target as Node)) {
        handleDeselect();
      }
    };
    const id = setTimeout(() => {
      document.addEventListener('mousedown', handler);
      document.addEventListener('touchstart', handler);
    }, 50);
    return () => {
      clearTimeout(id);
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [isFused]);

  // ── Budget analysis ───────────────────────────────────────────────────────
  const budgetConfig = useMemo((): BudgetConfiguration => {
    if (personalBudget) {
      const categories = monthlyBudget?.categories
        ? { ...monthlyBudget.categories } : { ...personalBudget.categories };
      return { version: '2.0.0', lastUpdated: monthlyBudget?.updated_at || personalBudget.updated_at, categories, globalSettings: personalBudget.global_settings };
    }
    return { version: '2.0.0', lastUpdated: new Date().toISOString(), categories: {}, globalSettings: { currency: 'ILS', warningNotifications: true, emailAlerts: false } };
  }, [personalBudget, monthlyBudget]);

  const analysis = useMemo(
    () => budgetService.analyzeBudgetPerformanceWithConfig(transactions, monthName, year, budgetConfig),
    [transactions, monthName, year, budgetConfig]
  );

  const monthIncome = useMemo(
    () => transactions
      .filter(t => new Date(t.date).getMonth() === monthDate.getMonth() && new Date(t.date).getFullYear() === year && t.type === 'income')
      .reduce((s, t) => s + t.amount, 0),
    [transactions, monthDate, year]
  );

  const balance = monthIncome - analysis.totalSpent;
  const usagePct = analysis.totalBudgeted > 0 ? Math.min(100, (analysis.totalSpent / analysis.totalBudgeted) * 100) : 0;
  const variance = analysis.totalBudgeted - analysis.totalSpent;
  const overBudgetCount = analysis.categoryComparisons.filter(c => c.status === 'over').length;

  // ── Helpers ───────────────────────────────────────────────────────────────
  const hasCategoryTransactions = (name: string) =>
    transactions.some(t =>
      t.type === 'expense' && t.category === name &&
      new Date(t.date).getMonth() === monthDate.getMonth() &&
      new Date(t.date).getFullYear() === year
    );

  const handleDesktopTileClick = (name: string) => {
    if (!hasCategoryTransactions(name)) return;
    setInspectedCategories(prev => new Set([...prev, name]));
    const next = localSelected === name ? null : name;
    setLocalSelected(next);
    setIsFused(next !== null);
    onCategoryClick(name);
  };

  const handleSmallTileClick = (name: string) => {
    setInspectedCategories(prev => new Set([...prev, name]));
    setLocalSelected(prev => prev === name ? null : name);
    onCategoryClick(name);
  };

  const handleDeselect = () => { setLocalSelected(null); setIsFused(false); };

  // ── Chip definitions + actions ────────────────────────────────────────────
  type Chip = {
    label: string; value: string; sub?: string;
    color: string; bg: string; Icon: React.ElementType;
    action?: () => void; isActive?: boolean;
  };

  const chips: Chip[] = [
    {
      label: 'Income', value: formatCurrency(monthIncome),
      color: 'text-green-700 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20', Icon: TrendingUp,
      action: () => navigate('/?tab=transactions'),
    },
    {
      label: 'Expenses', value: formatCurrency(analysis.totalSpent),
      color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', Icon: TrendingDown,
      action: () => navigate('/?tab=transactions'),
    },
    {
      label: 'Balance', value: formatCurrency(Math.abs(balance)), sub: balance >= 0 ? '↑ surplus' : '↓ deficit',
      color: balance >= 0 ? 'text-blue-700 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400',
      bg:    balance >= 0 ? 'bg-blue-50 dark:bg-blue-900/20'   : 'bg-orange-50 dark:bg-orange-900/20',
      Icon: balance >= 0 ? CheckCircle : AlertTriangle,
    },
    {
      label: 'Budgeted', value: formatCurrency(analysis.totalBudgeted),
      sub: `${analysis.categoryComparisons.filter(c => c.budgeted > 0).length} categories`,
      color: 'text-gray-700 dark:text-gray-300', bg: 'bg-gray-50 dark:bg-gray-700/40', Icon: DollarSign,
      action: () => navigate('/?tab=budget'),
    },
    {
      label: 'Used', value: `${Math.round(usagePct)}%`, sub: 'of budget',
      color: usagePct >= 100 ? 'text-red-600 dark:text-red-400' : usagePct >= 75 ? 'text-yellow-600 dark:text-yellow-400' : 'text-purple-700 dark:text-purple-400',
      bg:    usagePct >= 100 ? 'bg-red-50 dark:bg-red-900/20'   : usagePct >= 75 ? 'bg-yellow-50 dark:bg-yellow-900/20'   : 'bg-purple-50 dark:bg-purple-900/20',
      Icon: Gauge,
    },
    {
      label: 'Variance', value: formatCurrency(Math.abs(variance)), sub: variance >= 0 ? 'under budget' : 'over budget',
      color: variance >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400',
      bg:    variance >= 0 ? 'bg-green-50 dark:bg-green-900/20'  : 'bg-red-50 dark:bg-red-900/20',
      Icon: ArrowDownUp,
    },
  ];

  if (overBudgetCount > 0) chips.push({
    label: 'Over budget', value: String(overBudgetCount), sub: `categor${overBudgetCount === 1 ? 'y' : 'ies'}`,
    color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', Icon: AlertTriangle,
    isActive: categoryFilter === 'over',
    action: () => setCategoryFilter(f => f === 'over' ? 'all' : 'over'),
  });

  if (monthlyBudget?.adjustment_count && monthlyBudget.adjustment_count > 0) chips.push({
    label: 'Adjustments', value: String(monthlyBudget.adjustment_count), sub: 'next month',
    color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20', Icon: Calendar,
    action: () => navigate('/?tab=budget'),
  });

  // ── Category sort + filter ────────────────────────────────────────────────
  const sortedCategories = useMemo(
    () => [...analysis.categoryComparisons]
      .filter(c => c.budgeted > 0)
      .sort((a, b) => {
        const pA = a.budgeted > 0 ? a.actual / a.budgeted : 0;
        const pB = b.budgeted > 0 ? b.actual / b.budgeted : 0;
        if ((a.status === 'over') !== (b.status === 'over')) return a.status === 'over' ? -1 : 1;
        if ((a.actual === 0) !== (b.actual === 0)) return a.actual === 0 ? 1 : -1;
        return pB - pA;
      }),
    [analysis.categoryComparisons]
  );

  const displayedCategories = useMemo(
    () => categoryFilter === 'over' ? sortedCategories.filter(c => c.status === 'over') : sortedCategories,
    [sortedCategories, categoryFilter]
  );

  // ── Sub-renderers ─────────────────────────────────────────────────────────
  const renderChipCard = ({ label, value, sub, color, bg, Icon, action, isActive }: Chip) => {
    const interactive = !!action;
    const Tag = interactive ? 'button' : 'div';
    return (
      <Tag
        key={label}
        onClick={action}
        className={`rounded-xl p-3 text-left transition-all
          ${bg} border border-white/60 dark:border-gray-700/50
          ${interactive
            ? `cursor-pointer shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:shadow-md
               ${isActive ? 'ring-2 ring-offset-1 ring-purple-400 dark:ring-purple-500' : ''}`
            : 'shadow-sm'
          }`}
        {...(interactive ? { type: 'button' as const } : {})}
      >
        <div className="flex items-center gap-1 mb-1.5">
          <Icon className={`h-3 w-3 ${color} flex-shrink-0`} />
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{label}</p>
        </div>
        <p className={`text-base font-bold leading-none ${color} truncate`}>{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-1 truncate">{sub}</p>}
      </Tag>
    );
  };

  const renderCategoryGrid = (onTileClick: (name: string) => void) => (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      {/* Heading */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
          Category Breakdown
          {categoryFilter === 'over' && (
            <span className="ml-2 text-xs font-normal text-red-500 dark:text-red-400">· over budget</span>
          )}
        </h3>
        {categoryFilter !== 'all' && (
          <button
            onClick={() => setCategoryFilter('all')}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            Show all
          </button>
        )}
      </div>

      {/* Encouragement when filter=over but nothing over budget */}
      {categoryFilter === 'over' && displayedCategories.length === 0 ? (
        <div className="p-6 text-center">
          <Sparkles className="h-8 w-8 text-green-500 mx-auto mb-2" />
          <p className="text-sm font-medium text-green-700 dark:text-green-400">Looking great!</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">No categories over budget this month.</p>
        </div>
      ) : displayedCategories.length === 0 ? (
        <div className="p-6 text-center text-gray-400 text-sm">
          <p>No budget categories configured</p>
        </div>
      ) : (
        <div className="relative">
          <div
            ref={catGridRef}
            className="grid grid-cols-2 gap-2 p-2 max-h-[320px] overflow-y-auto"
          >
            {displayedCategories.map(comp => {
              const pct = comp.budgeted > 0 ? Math.min(100, (comp.actual / comp.budgeted) * 100) : 0;
              const catColor = personalBudget?.categories[comp.category]?.color;
              const showDot = comp.status === 'over' && !inspectedCategories.has(comp.category);
              const isSelected = localSelected === comp.category;
              const noTxns = !hasCategoryTransactions(comp.category);

              return (
                <button
                  key={comp.category}
                  onClick={() => onTileClick(comp.category)}
                  className={`relative text-left p-3 rounded-lg border transition-all
                    ${isSelected
                      ? 'border-purple-400 dark:border-purple-500 bg-purple-50 dark:bg-purple-900/20 shadow-sm'
                      : noTxns
                      ? 'border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-700/20 opacity-60 cursor-default'
                      : 'border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/40 hover:border-purple-300 dark:hover:border-purple-600 hover:shadow-sm'
                    }`}
                >
                  {showDot && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-gray-700" />
                  )}
                  <div className="flex items-center gap-1.5 mb-2">
                    {catColor && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: catColor }} />}
                    <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{comp.category}</span>
                  </div>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{formatCurrency(comp.actual)}</span>
                    <span className="text-xs text-gray-400 ml-1">/ {formatCurrency(comp.budgeted)}</span>
                  </div>
                  <div className="h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${progressColor(pct)}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{Math.round(pct)}%</p>
                </button>
              );
            })}
          </div>

          {/* Scroll-to-see-more fade */}
          <AnimatePresence>
            {catScrollable && !catAtBottom && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-white dark:from-gray-800 to-transparent pointer-events-none rounded-b-xl"
              />
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto">

      {/* ── SMALL / MEDIUM: stacked ── */}
      <div className="lg:hidden space-y-4">
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(chips.length, 6)}, minmax(0, 1fr))` }}>
          {chips.map(renderChipCard)}
        </div>
        {renderCategoryGrid(handleSmallTileClick)}
        <ExpenseChart
          categoryData={categoryData} transactions={transactions} personalBudget={personalBudget}
          formatCurrency={formatCurrency} selectedCategory={localSelected}
          onEditTransaction={onEditTransaction} onViewAllTransactions={onViewAllTransactions}
        />
      </div>

      {/* ── LARGE: [categories + pie] LEFT | [chips sticky 2-col] RIGHT ── */}
      <div className="hidden lg:flex gap-5">

        {/* LEFT */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Block-level X shown when fused */}
          <AnimatePresence>
            {isFused && (
              <motion.div
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
                className="flex items-center justify-between px-1"
              >
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{localSelected}</span>
                <button
                  onClick={handleDeselect}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm transition-colors"
                >
                  <X className="h-4 w-4" />Close
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Categories — fade+expand in, fade+collapse out */}
          <AnimatePresence>
            {!isFused && (
              <motion.div
                key="cat-grid"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                {renderCategoryGrid(handleDesktopTileClick)}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ExpenseChart */}
          <div ref={expensesCardRef}>
            <ExpenseChart
              categoryData={categoryData} transactions={transactions} personalBudget={personalBudget}
              formatCurrency={formatCurrency} selectedCategory={localSelected}
              onEditTransaction={onEditTransaction} onViewAllTransactions={onViewAllTransactions}
              onDeselect={handleDeselect}
            />
          </div>
        </div>

        {/* RIGHT: chips — sticky so they float as user scrolls */}
        <div className="flex-shrink-0 w-[260px] sticky top-4 self-start">
          <div className="grid grid-cols-2 gap-2">
            {chips.map(renderChipCard)}
          </div>
        </div>

      </div>
    </div>
  );
};
