/**
 * Date Helper Utilities
 * Provides functions for date formatting and manipulation
 */

import { getUserLocale } from './locale';

/**
 * Get formatted month and year label (e.g., "January 2025")
 */
export const getMonthLabel = (date: Date): string => {
  return date.toLocaleString(getUserLocale(), { month: 'long', year: 'numeric' });
};

/**
 * Get month name only (e.g., "January")
 */
export const getMonthName = (date: Date): string => {
  return date.toLocaleString(getUserLocale(), { month: 'long' });
};

/**
 * Get year as string (e.g., "2025")
 */
export const getYear = (date: Date): string => {
  return date.getFullYear().toString();
};

/**
 * Get first day of the month
 */
export const getMonthStart = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

/**
 * Get last day of the month (at end of day 23:59:59.999)
 */
export const getMonthEnd = (date: Date): Date => {
  // Get the last day of the month at 23:59:59.999 to include the full day
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  lastDay.setHours(23, 59, 59, 999);
  return lastDay;
};

/**
 * Generate array of last N months with date info
 * @param count Number of months to generate (including current)
 * @returns Array of month objects with label, name, year, start, and end dates
 */
export const getLastNMonths = (count: number = 4) => {
  const now = new Date();
  return Array.from({ length: count }, (_, offset) => {
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    return {
      label: getMonthLabel(d),
      monthName: getMonthName(d),
      year: getYear(d),
      start: getMonthStart(d),
      end: getMonthEnd(d),
    };
  });
};

/**
 * Format a date as a month key (e.g., "2026-09"), used in URLs
 */
export const toMonthKey = (date: Date): string => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

/**
 * Parse a month key (e.g., "2026-09") into the first day of that month
 * @returns null if the key is missing or malformed
 */
export const parseMonthKey = (key: string | null | undefined): Date | null => {
  const match = key?.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return new Date(Number(match[1]), month - 1, 1);
};

/**
 * Index of the month to show by default in a newest-first month list:
 * the current month, or the closest past month if the current one has no data.
 * Future months (e.g. upcoming installments) are skipped.
 */
export const getDefaultMonthIndex = (months: { start: Date }[], now: Date = new Date()): number => {
  const currentMonthStart = getMonthStart(now);
  const index = months.findIndex(m => m.start <= currentMonthStart);
  return index === -1 ? Math.max(months.length - 1, 0) : index;
};

/**
 * Check if a date falls within a date range
 */
export const isDateInRange = (date: Date, start: Date, end: Date): boolean => {
  return date >= start && date <= end;
};

/**
 * Get all unique months that have transactions
 * @param transactions Array of transactions
 * @returns Array of month objects sorted from newest to oldest
 */
export const getMonthsWithData = (transactions: { date: string | Date }[]) => {
  if (!transactions || transactions.length === 0) {
    // Return current month if no transactions
    const now = new Date();
    return [{
      label: getMonthLabel(now),
      monthName: getMonthName(now),
      year: getYear(now),
      start: getMonthStart(now),
      end: getMonthEnd(now),
    }];
  }

  // Extract unique year-month combinations
  const monthSet = new Set<string>();
  transactions.forEach(t => {
    const date = new Date(t.date);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    monthSet.add(key);
  });

  // Convert to sorted array of month objects (newest first)
  const months = Array.from(monthSet)
    .map(key => {
      const [year, month] = key.split('-').map(Number);
      const d = new Date(year, month, 1);
      return {
        label: getMonthLabel(d),
        monthName: getMonthName(d),
        year: getYear(d),
        start: getMonthStart(d),
        end: getMonthEnd(d),
      };
    })
    .sort((a, b) => b.start.getTime() - a.start.getTime());

  return months;
};
