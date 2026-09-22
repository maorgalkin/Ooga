import { useMemo } from 'react';
import { getMonthsWithData, getMonthStart, getMonthEnd, isDateInRange } from '../utils/dateHelpers';
import type { Transaction, FamilyMember, BudgetConfiguration } from '../types';

interface MonthData {
  label: string;
  monthName: string;
  year: string;
  start: Date;
  end: Date;
}

interface CategoryData {
  category: string;
  amount: number;
}

interface UseDashboardDataProps {
  transactions: Transaction[];
  familyMembers: FamilyMember[];
  budgetConfig: BudgetConfiguration | null; // Reserved for future budget-aware calculations
  activeMonthIndex: number | null; // null = single month mode (Dashboard), number = multi-month carousel mode (Transactions)
  dashboardMonth?: Date; // Month shown in single month mode; defaults to the current calendar month
}

interface UseDashboardDataReturn {
  months: MonthData[];
  monthTransactions: Transaction[];
  monthCategoryData: CategoryData[];
  selectedMonthDate: Date;
  getTransactionsForMonth: (start: Date, end: Date) => Transaction[];
  getFamilyMemberName: (id: string | undefined) => string | undefined;
}

/**
 * Custom hook for managing dashboard data and calculations
 * Encapsulates transaction filtering, category aggregation, and month management
 */
export function useDashboardData({
  transactions,
  familyMembers,
  budgetConfig: _budgetConfig, // Reserved for future budget-aware calculations
  activeMonthIndex,
  dashboardMonth,
}: UseDashboardDataProps): UseDashboardDataReturn {
  
  // Get months that have transaction data (sorted newest to oldest)
  const months = useMemo(() => getMonthsWithData(transactions), [transactions]);

  // Filter transactions by date range (memoized to avoid stale closures)
  const getTransactionsForMonth = useMemo(
    () => (start: Date, end: Date) =>
      transactions.filter(t => {
        const d = new Date(t.date);
        return isDateInRange(d, start, end);
      }),
    [transactions]
  );

  // Determine month data based on mode
  // null activeMonthIndex = single month (Dashboard): the requested month, or the current calendar month.
  //   Not months[0] — that is the newest month with data, which can be far in the future with installments.
  // number activeMonthIndex = carousel mode (Transactions)
  const dashboardMonthTime = getMonthStart(dashboardMonth ?? new Date()).getTime();
  const { selectedMonthStart, selectedMonthEnd } = useMemo(() => {
    if (activeMonthIndex === null) {
      const start = new Date(dashboardMonthTime);
      return { selectedMonthStart: start, selectedMonthEnd: getMonthEnd(start) };
    }
    const month = months[Math.min(activeMonthIndex, months.length - 1)];
    return { selectedMonthStart: month.start, selectedMonthEnd: month.end };
  }, [activeMonthIndex, dashboardMonthTime, months]);
  const selectedMonthDate = selectedMonthStart;

  // Filter transactions for the selected month
  const monthTransactions = useMemo(
    () => getTransactionsForMonth(selectedMonthStart, selectedMonthEnd),
    [getTransactionsForMonth, selectedMonthStart, selectedMonthEnd]
  );

  // Calculate category-wise expenses for the selected month
  const monthCategoryData = useMemo(() => {
    return monthTransactions
      .filter((t: Transaction) => t.type === 'expense')
      .reduce((acc: CategoryData[], transaction: Transaction) => {
        const existing = acc.find((item) => item.category === transaction.category);
        if (existing) {
          existing.amount += transaction.amount;
        } else {
          acc.push({ category: transaction.category, amount: transaction.amount });
        }
        return acc;
      }, []);
  }, [monthTransactions]);

  // Helper to get family member name from ID
  const getFamilyMemberName = (id: string | undefined): string | undefined => {
    if (!id) return undefined;
    const member = familyMembers.find(m => m.id === id);
    return member?.name;
  };

  return {
    months,
    monthTransactions,
    monthCategoryData,
    selectedMonthDate,
    getTransactionsForMonth,
    getFamilyMemberName,
  };
}
