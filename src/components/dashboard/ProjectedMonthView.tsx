// Projected month (future) — shows only charges that are already committed:
// in-app installment rows and the expected remaining payments of bank installments.
// The budget is built in memory; nothing here reads or creates a monthly budget row.

import React, { useMemo } from 'react';
import { CalendarClock, Lock, PiggyBank, Wallet } from 'lucide-react';
import { usePendingAdjustmentsThrough } from '../../hooks/useBudgets';
import { buildProjectedBudgetLimits } from '../../utils/projections';
import { getCategoryColor } from '../../utils/categoryColors';
import { getUserLocale } from '../../utils/locale';
import type { Transaction } from '../../types';
import type { PersonalBudget } from '../../types/budget';

interface ProjectedMonthViewProps {
  monthDate: Date;
  transactions: Transaction[]; // Committed charges in this month (future-dated rows + projected ones)
  personalBudget: PersonalBudget | null | undefined;
  formatCurrency: (amount: number) => string;
  onViewTransaction: (t: Transaction) => void;
}

export const ProjectedMonthView: React.FC<ProjectedMonthViewProps> = ({
  monthDate,
  transactions,
  personalBudget,
  formatCurrency,
  onViewTransaction,
}) => {
  const { data: pendingAdjustments = [] } = usePendingAdjustmentsThrough(
    monthDate.getFullYear(),
    monthDate.getMonth() + 1
  );

  const limits = useMemo(
    () => buildProjectedBudgetLimits(personalBudget, pendingAdjustments, monthDate),
    [personalBudget, pendingAdjustments, monthDate]
  );

  const expenses = useMemo(() => transactions.filter(t => t.type === 'expense'), [transactions]);
  const committed = expenses.reduce((sum, t) => sum + t.amount, 0);
  const committedIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const budgeted = Object.values(limits).reduce((sum, limit) => sum + limit, 0);
  const freeToSpend = budgeted - committed;

  const categories = useMemo(() => {
    const byCategory = new Map<string, number>();
    expenses.forEach(t => byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + t.amount));
    return [...byCategory.entries()]
      .map(([category, amount]) => ({ category, amount, limit: limits[category] ?? 0 }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses, limits]);

  const charges = useMemo(
    () => [...transactions].sort((a, b) => a.date.localeCompare(b.date) || b.amount - a.amount),
    [transactions]
  );

  const monthName = monthDate.toLocaleDateString(getUserLocale(), { month: 'long' });

  const tiles = [
    { label: 'Committed', value: formatCurrency(committed), sub: `${expenses.length} charge${expenses.length === 1 ? '' : 's'}`, Icon: Lock,
      color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' },
    { label: 'Budget', value: formatCurrency(budgeted), sub: `${Object.keys(limits).length} categories`, Icon: Wallet,
      color: 'text-gray-700 dark:text-gray-300', bg: 'bg-gray-50 dark:bg-gray-700/40' },
    { label: 'Free to spend', value: formatCurrency(Math.abs(freeToSpend)), sub: freeToSpend >= 0 ? 'after committed charges' : 'over budget already',
      Icon: PiggyBank,
      color: freeToSpend >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400',
      bg: freeToSpend >= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20' },
  ];

  return (
    <div className="space-y-5">
      {/* What this view is */}
      <div className="flex items-start gap-3 rounded-xl border-2 border-dashed border-purple-300 dark:border-purple-700 bg-white/60 dark:bg-gray-800/60 px-4 py-3">
        <CalendarClock className="h-5 w-5 text-purple-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-gray-600 dark:text-gray-300">
          <span className="font-semibold text-purple-700 dark:text-purple-300">Projection.</span>{' '}
          Only charges already committed for {monthName} (installment payments) are shown. Day-to-day spending will add to this.
          {committedIncome > 0 && <> Committed income: <span className="font-medium">{formatCurrency(committedIncome)}</span>.</>}
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {tiles.map(({ label, value, sub, Icon, color, bg }) => (
          <div key={label} className={`rounded-xl p-4 ${bg} border border-dashed border-gray-300 dark:border-gray-600`}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Icon className={`h-4 w-4 ${color}`} />
              <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
            </div>
            <p className={`text-xl font-bold leading-none ${color}`}>{value}</p>
            <p className="text-xs text-gray-400 mt-1">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Committed per category, against that month's budget */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-200">
            Already committed by category
          </h3>
          {categories.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-400">No committed charges in {monthName}.</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {categories.map(({ category, amount, limit }) => {
                const pct = limit > 0 ? Math.min(100, (amount / limit) * 100) : 100;
                const over = limit > 0 && amount > limit;
                return (
                  <li key={category} className="px-4 py-3">
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="flex items-center gap-2 font-medium text-gray-800 dark:text-gray-100">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: getCategoryColor(category, 'expense', personalBudget).hexColor }} />
                        {category}
                      </span>
                      <span className={over ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-600 dark:text-gray-300'}>
                        {formatCurrency(amount)}
                        <span className="text-gray-400"> / {limit > 0 ? formatCurrency(limit) : 'not budgeted'}</span>
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${over || limit === 0 ? 'bg-red-400' : 'bg-purple-400'}`}
                        style={{ width: `${pct}%`, backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,.35) 0 4px, transparent 4px 8px)' }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* The charges themselves */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-200">
            Committed charges
          </h3>
          {charges.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-400">Nothing scheduled yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {charges.map(t => {
                const hasInstallment = !!t.installment_number && !!t.installment_total;
                const Tag = t.projected ? 'div' : 'button';
                return (
                  <li key={t.id}>
                    <Tag
                      {...(t.projected ? {} : { type: 'button' as const, onClick: () => onViewTransaction(t) })}
                      className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left ${t.projected ? '' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{t.description}</p>
                        <p className="text-xs text-gray-400 flex items-center gap-2">
                          {new Date(t.date + 'T00:00:00').toLocaleDateString(getUserLocale(), { day: 'numeric', month: 'short' })}
                          <span>· {t.category}</span>
                          {hasInstallment && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${t.projected
                              ? 'border border-dashed border-purple-400 text-purple-600 dark:text-purple-300'
                              : 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'}`}
                            >
                              {t.projected ? 'Expected' : 'Installment'} {t.installment_number}/{t.installment_total}
                            </span>
                          )}
                        </p>
                      </div>
                      <span className={`text-sm font-semibold flex-shrink-0 ${t.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-gray-800 dark:text-gray-100'}`}>
                        {t.type === 'income' ? '+' : ''}{formatCurrency(t.amount)}
                      </span>
                    </Tag>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
