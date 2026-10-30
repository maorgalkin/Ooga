import React, { useMemo, useState, useEffect } from 'react';
import { CalendarRange, TrendingDown } from 'lucide-react';
import type { Transaction } from '../../types';
import type { PersonalBudget } from '../../types/budget';
import type { DateRangeType } from '../../utils/dateRangeFilters';
import { getDateRange } from '../../utils/dateRangeFilters';
import { formatCurrencyFromSettings } from '../../utils/formatCurrency';
import { getUserLocale } from '../../utils/locale';

interface CategoryPacingInsightProps {
  transactions: Transaction[];
  personalBudget: PersonalBudget | null | undefined;
  selectedRange: DateRangeType;
}

interface MonthBucket {
  key: string;
  year: number;
  month: number; // 0-indexed
  start: Date;
  end: Date;
}

interface CheckpointConfig {
  id: string;
  label: string;
  day: number;
  description: string;
}

interface CheckpointRow {
  id: string;
  label: string;
  day: number;
  currentAmount: number;
  currentPercentage: number | null;
  averageAmount: number | null;
  averagePercentage: number | null;
  varianceAmount: number | null;
  variancePercentage: number | null;
  description: string;
}

const BASE_CHECKPOINTS: CheckpointConfig[] = [
  {
    id: 'week1',
    label: 'End of week 1',
    day: 7,
    description: 'First-week pace check after seven days.'
  },
  {
    id: 'mid',
    label: 'Mid-month',
    day: 15,
    description: 'Halfway checkpoint for quick course correction.'
  },
  {
    id: 'week4',
    label: 'End of week 4',
    day: 28,
    description: 'Late-month snapshot before the month closes.'
  }
];

const getMonthBuckets = (start: Date, end: Date): MonthBucket[] => {
  const buckets: MonthBucket[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const limit = new Date(end.getFullYear(), end.getMonth(), 1);

  while (cursor <= limit) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const key = `${year}-${String(month + 1).padStart(2, '0')}`;
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);

    buckets.push({
      key,
      year,
      month,
      start: monthStart,
      end: monthEnd,
    });

    cursor.setMonth(cursor.getMonth() + 1);
  }

  return buckets;
};

const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

const clampDayToMonth = (year: number, month: number, targetDay: number) => {
  const daysInMonth = getDaysInMonth(year, month);
  return Math.min(targetDay, daysInMonth);
};

const normalizeAmount = (transactions: Transaction[], day: number, year: number, month: number, category: string) => {
  if (!transactions.length) {
    return 0;
  }

  return transactions.reduce((total, txn) => {
    if (txn.type !== 'expense') {
      return total;
    }

    if (txn.category !== category) {
      return total;
    }

    const txnDate = new Date(txn.date);
    if (txnDate.getFullYear() !== year || txnDate.getMonth() !== month) {
      return total;
    }

    const txnDay = txnDate.getDate();
    if (txnDay <= day) {
      return total + Math.abs(txn.amount);
    }

    return total;
  }, 0);
};

const calculateCheckpointRows = (
  buckets: MonthBucket[],
  transactions: Transaction[],
  category: string,
  budgetLimit: number,
  includeCurrentDay: boolean
): CheckpointRow[] => {
  if (!buckets.length) {
    return [];
  }

  const latestBucket = buckets[buckets.length - 1];
  const today = new Date();
  const isLatestMonthCurrent =
    today.getFullYear() === latestBucket.year &&
    today.getMonth() === latestBucket.month;

  const currentDayTarget = clampDayToMonth(
    latestBucket.year,
    latestBucket.month,
    isLatestMonthCurrent ? today.getDate() : getDaysInMonth(latestBucket.year, latestBucket.month)
  );

  const checkpoints: CheckpointConfig[] = [
    ...BASE_CHECKPOINTS,
    {
      id: 'current',
      label: `Current pace`,
      day: currentDayTarget,
      description: isLatestMonthCurrent
        ? 'Where you stand as of today.'
        : 'Final position for the most recent month in range.'
    }
  ];

  const historicalBuckets = buckets.length > 1 ? buckets.slice(0, -1) : [];

  return checkpoints
    .filter(cp => includeCurrentDay || cp.id !== 'current')
    .reduce<CheckpointRow[]>((rows, checkpoint) => {
      const { id, label, description } = checkpoint;
      const day = checkpoint.day;

      const currentAmount = normalizeAmount(
        transactions,
        day,
        latestBucket.year,
        latestBucket.month,
        category
      );

      const currentPercentage = budgetLimit > 0
        ? (currentAmount / budgetLimit) * 100
        : null;

      let averageAmount: number | null = null;
      let averagePercentage: number | null = null;
      let varianceAmount: number | null = null;
      let variancePercentage: number | null = null;

      if (historicalBuckets.length > 0) {
        const totals = historicalBuckets.map(bucket => {
          const clampedDay = clampDayToMonth(bucket.year, bucket.month, day);
          return normalizeAmount(transactions, clampedDay, bucket.year, bucket.month, category);
        });

        const sampleCount = totals.length;
        if (sampleCount > 0) {
          const sum = totals.reduce((acc, value) => acc + value, 0);
          averageAmount = sum / sampleCount;
          averagePercentage = budgetLimit > 0 ? (averageAmount / budgetLimit) * 100 : null;
          varianceAmount = currentAmount - averageAmount;
          variancePercentage = averagePercentage !== null && currentPercentage !== null
            ? currentPercentage - averagePercentage
            : null;
        }
      }

      rows.push({
        id,
        label,
        day,
        currentAmount,
        currentPercentage,
        averageAmount,
        averagePercentage,
        varianceAmount,
        variancePercentage,
        description,
      });

      return rows;
    }, []);
};

const getCategoryOptions = (budget: PersonalBudget | null | undefined) => {
  if (!budget?.categories) {
    return [];
  }

  return Object.entries(budget.categories)
    .filter(([, config]) => config?.isActive)
    .map(([name, config]) => ({
      name,
      monthlyLimit: config?.monthlyLimit ?? 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

export const CategoryPacingInsight: React.FC<CategoryPacingInsightProps> = ({
  transactions,
  personalBudget,
  selectedRange,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  const categoryOptions = useMemo(() => getCategoryOptions(personalBudget), [personalBudget]);

  useEffect(() => {
    if (!selectedCategory && categoryOptions.length > 0) {
      setSelectedCategory(categoryOptions[0].name);
    } else if (
      selectedCategory &&
      categoryOptions.length > 0 &&
      !categoryOptions.find(option => option.name === selectedCategory)
    ) {
      setSelectedCategory(categoryOptions[0].name);
    }
  }, [categoryOptions, selectedCategory]);

  const dateRange = useMemo(() => getDateRange(selectedRange), [selectedRange]);

  const monthBuckets = useMemo(() => {
    if (!dateRange.startDate || !dateRange.endDate) {
      return [];
    }
    return getMonthBuckets(dateRange.startDate, dateRange.endDate);
  }, [dateRange.startDate, dateRange.endDate]);

  const budgetLimit = useMemo(() => {
    if (!selectedCategory || !personalBudget?.categories) {
      return 0;
    }
    return personalBudget.categories[selectedCategory]?.monthlyLimit ?? 0;
  }, [personalBudget?.categories, selectedCategory]);

  const filteredTransactions = useMemo(() => {
    if (!dateRange.startDate || !dateRange.endDate) {
      return [] as Transaction[];
    }
    const startTime = dateRange.startDate.getTime();
    const endTime = dateRange.endDate.getTime();
    return transactions.filter(txn => {
      const txnTime = new Date(txn.date).getTime();
      return txnTime >= startTime && txnTime <= endTime;
    });
  }, [transactions, dateRange.startDate, dateRange.endDate]);

  const pacingRows = useMemo(() => {
    if (!selectedCategory || monthBuckets.length === 0) {
      return [];
    }
    return calculateCheckpointRows(
      monthBuckets,
      filteredTransactions,
      selectedCategory,
      budgetLimit,
      true
    );
  }, [monthBuckets, filteredTransactions, selectedCategory, budgetLimit]);

  const latestBucket = monthBuckets.length > 0 ? monthBuckets[monthBuckets.length - 1] : null;
  const latestMonthLabel = latestBucket
    ? new Intl.DateTimeFormat(getUserLocale(), { month: 'long', year: 'numeric' }).format(
        new Date(latestBucket.year, latestBucket.month, 1)
      )
    : null;

  const hasHistoricalSample = monthBuckets.length > 1;
  const formatCurrency = (amount: number) =>
    formatCurrencyFromSettings(amount, personalBudget?.global_settings);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-indigo-50 to-sky-50 dark:from-indigo-900/20 dark:to-sky-900/20">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg">
            <CalendarRange className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Category pace tracker
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Monitor how a category is tracking toward its monthly budget checkpoints.
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-4">
        {!personalBudget && (
          <div className="rounded-lg bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 p-4 text-sm text-indigo-800 dark:text-indigo-200">
            Connect a personal budget to analyse pacing against category limits.
          </div>
        )}

        {personalBudget && categoryOptions.length === 0 && (
          <div className="rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 text-sm text-gray-600 dark:text-gray-300">
            No active expense categories found in the current budget configuration.
          </div>
        )}

        {personalBudget && categoryOptions.length > 0 && (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Category</span>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedCategory}
                    onChange={event => setSelectedCategory(event.target.value)}
                    className="mt-1 block w-full sm:w-64 rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  >
                    {categoryOptions.map(option => (
                      <option key={option.name} value={option.name}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                  {budgetLimit > 0 ? (
                    <span className="text-xs font-medium text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/40 px-2.5 py-1 rounded-full">
                      Monthly limit: {formatCurrency(budgetLimit)}
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      No limit configured
                    </span>
                  )}
                </div>
              </div>
              {latestMonthLabel && (
                <div className="text-sm text-right text-gray-500 dark:text-gray-400">
                  Tracking {selectedCategory} through {latestMonthLabel}
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    <th className="py-2">Checkpoint</th>
                    <th className="py-2">Spent</th>
                    <th className="py-2">Remaining</th>
                    {hasHistoricalSample && <th className="py-2">Historical avg</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {pacingRows.length === 0 && (
                    <tr>
                      <td className="py-3 text-gray-500 dark:text-gray-400" colSpan={hasHistoricalSample ? 4 : 3}>
                        No spending activity recorded for this category in the selected range.
                      </td>
                    </tr>
                  )}

                  {pacingRows.map(row => {
                    const percentageFormatter = (value: number | null) =>
                      value === null ? '—' : `${Math.round(value)}%`;

                    const varianceFormatter = (value: number | null) => {
                      if (value === null) {
                        return '—';
                      }
                      const rounded = Math.round(value);
                      if (rounded === 0) {
                        return 'On pace';
                      }
                      return `${rounded > 0 ? '+' : ''}${rounded}%`;
                    };

                    const varianceTone = row.variancePercentage !== null
                      ? row.variancePercentage > 5
                        ? 'text-red-500 dark:text-red-400'
                        : row.variancePercentage < -5
                          ? 'text-emerald-500 dark:text-emerald-400'
                          : 'text-amber-500 dark:text-amber-400'
                      : 'text-gray-500 dark:text-gray-400';

                    const remainingAmount = budgetLimit > 0
                      ? Math.max(budgetLimit - row.currentAmount, 0)
                      : null;
                    const remainingPercentage =
                      budgetLimit > 0 && row.currentPercentage !== null
                        ? Math.max(100 - row.currentPercentage, 0)
                        : null;

                    return (
                      <tr key={row.id}>
                        <td className="py-3">
                          <div className="font-medium text-gray-900 dark:text-gray-100">
                            {row.label}
                            {row.id === 'current' && latestBucket && (
                              <span className="ml-2 text-xs font-normal text-indigo-600 dark:text-indigo-300">
                                Day {row.day}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {row.description}
                          </div>
                        </td>
                        <td className="py-3">
                          <div className="font-medium text-gray-900 dark:text-gray-100">
                            {formatCurrency(row.currentAmount)}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {percentageFormatter(row.currentPercentage)} of budget
                          </div>
                        </td>
                        <td className="py-3">
                          {remainingAmount !== null ? (
                            <>
                              <div className="font-medium text-gray-900 dark:text-gray-100">
                                {formatCurrency(remainingAmount)}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {percentageFormatter(remainingPercentage)} remaining
                              </div>
                            </>
                          ) : (
                            <div className="text-xs text-gray-500 dark:text-gray-400">No budget target</div>
                          )}
                        </td>
                        {hasHistoricalSample && (
                          <td className="py-3">
                            {row.averageAmount !== null ? (
                              <>
                                <div className="font-medium text-gray-900 dark:text-gray-100">
                                  {formatCurrency(row.averageAmount)}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  Avg {percentageFormatter(row.averagePercentage)}
                                </div>
                                <div className={`text-xs font-medium ${varianceTone}`}>
                                  {varianceFormatter(row.variancePercentage)} vs avg
                                </div>
                              </>
                            ) : (
                              <div className="text-xs text-gray-500 dark:text-gray-400">—</div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {hasHistoricalSample && (
              <div className="flex items-start gap-2 rounded-lg border border-indigo-100 dark:border-indigo-800 bg-indigo-50/60 dark:bg-indigo-900/30 p-3 text-xs text-indigo-700 dark:text-indigo-200">
                <TrendingDown className="h-4 w-4 mt-0.5" />
                <p>
                  Historical averages use each month in the selected range except the most recent month. This highlights how current spending compares to typical pacing.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
