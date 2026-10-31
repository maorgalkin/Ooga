/**
 * Date Range Filter Utilities
 * Provides standardized date range filtering for analytics views
 */

import type { Transaction } from '../types';
import { getUserLocale } from './locale';
import { parseTransactionDate } from './dateHelpers';

/** The end of the given day, so a range ending on it includes all of it. */
const endOfDay = (year: number, month: number, day: number) => new Date(year, month, day, 23, 59, 59, 999);

export type DateRangeType = 'mtd' | 'ytd' | 'qtd' | 'lastQuarter' | 'lastYear';

export interface DateRange {
  startDate: Date;
  endDate: Date;
  label: string;
  abbreviation: string;
}

export function getDateRange(rangeType: DateRangeType): DateRange {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  // Ranges "to date" include all of today: transactions carry a day, not a time
  const endOfToday = endOfDay(currentYear, currentMonth, today.getDate());
  const currentQuarter = Math.floor(currentMonth / 3);
  const quarterNames = ['Q1', 'Q2', 'Q3', 'Q4'];
  
  switch (rangeType) {
    case 'mtd':
      return {
        startDate: new Date(currentYear, currentMonth, 1),
        endDate: endOfToday,
        label: `${today.toLocaleDateString(getUserLocale(), { month: 'long' })} ${currentYear}`,
        abbreviation: 'MTD'
      };
    
    case 'ytd':
      return {
        startDate: new Date(currentYear, 0, 1),
        endDate: endOfToday,
        label: `${currentYear} (YTD)`,
        abbreviation: 'YTD'
      };
    
    case 'qtd':
      const quarterStartMonth = currentQuarter * 3;
      
      return {
        startDate: new Date(currentYear, quarterStartMonth, 1),
        endDate: endOfToday,
        label: `${quarterNames[currentQuarter]} ${currentYear} (QTD)`,
        abbreviation: 'QTD'
      };
    
    case 'lastQuarter':
      const lastQuarter = currentQuarter === 0 ? 3 : currentQuarter - 1;
      const lastQuarterYear = currentQuarter === 0 ? currentYear - 1 : currentYear;
      
      return {
        startDate: new Date(lastQuarterYear, lastQuarter * 3, 1),
        endDate: endOfDay(lastQuarterYear, (lastQuarter + 1) * 3, 0),
        label: `${quarterNames[lastQuarter]} ${lastQuarterYear}`,
        abbreviation: quarterNames[lastQuarter]
      };
    
    case 'lastYear':
      // Last 12 months: from 1st of last completed month's year-ago to last day of last completed month
      const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const startMonth = lastMonth;
      const startYear = lastMonthYear - 1;
      
      return {
        startDate: new Date(startYear, startMonth, 1),
        endDate: endOfDay(lastMonthYear, lastMonth + 1, 0),
        label: `Last 12 Months`,
        abbreviation: '12M'
      };
  }
}

export function filterTransactionsByDateRange(
  transactions: Transaction[],
  rangeType: DateRangeType
): Transaction[] {
  const { startDate, endDate } = getDateRange(rangeType);
  
  return transactions.filter(t => {
    const transactionDate = parseTransactionDate(t.date);
    return transactionDate >= startDate && transactionDate <= endDate;
  });
}

export function formatDateRange(startDate: Date, endDate: Date): string {
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  return `${startDate.toLocaleDateString(getUserLocale(), options)} - ${endDate.toLocaleDateString(getUserLocale(), options)}`;
}
