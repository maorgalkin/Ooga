/**
 * Transaction Filtering Utilities
 * Pure functions for filtering transactions based on various criteria
 * Extracted from Dashboard.tsx to enable reusability and testing
 */

import type { Transaction } from '../types';

export interface TransactionFilterState {
  types: ('income' | 'expense')[]; // Empty array means show all
  members: string[]; // Empty array means show all (member IDs)
  month: string; // 'carousel-N' or 'YYYY-MM' format
  categories: string[]; // Empty array means show all (category names)
}

export interface MonthData {
  label: string;
  monthName: string;
  year: string;
  start: Date;
  end: Date;
}

/**
 * Apply month filter to transactions
 * Supports two formats:
 * - 'carousel-N': Use month from carousel array at index N
 * - 'YYYY-MM': Parse year and month directly
 */
export function filterByMonth(
  transactions: Transaction[],
  monthFilter: string,
  months: MonthData[],
  getTransactionsForMonth: (start: Date, end: Date) => Transaction[]
): Transaction[] {
  if (monthFilter.startsWith('carousel-')) {
    // Extract carousel index and get transactions for that month
    const index = parseInt(monthFilter.split('-')[1], 10);
    if (index < 0 || index >= months.length) {
      return [];
    }
    return getTransactionsForMonth(months[index].start, months[index].end);
  } else {
    // Parse YYYY-MM format for older months
    const parts = monthFilter.split('-');
    if (parts.length !== 2) {
      return transactions; // Invalid format, return all
    }
    
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    
    if (isNaN(year) || isNaN(month)) {
      return transactions; // Invalid numbers, return all
    }
    
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);
    
    return transactions.filter(t => {
      const tDate = new Date(t.date);
      return tDate >= start && tDate <= end;
    });
  }
}

/**
 * Apply transaction type filter (income/expense)
 * Empty array means show all types
 */
export function filterByType(
  transactions: Transaction[],
  typeFilters: ('income' | 'expense')[]
): Transaction[] {
  if (typeFilters.length === 0) {
    return transactions; // Show all when no types selected
  }
  return transactions.filter(t => typeFilters.includes(t.type));
}

/**
 * Apply family member filter
 * Empty array means show all members
 */
export function filterByMember(
  transactions: Transaction[],
  memberFilters: string[]
): Transaction[] {
  if (memberFilters.length === 0) {
    return transactions; // Show all when no members selected
  }
  return transactions.filter(t => t.familyMember && memberFilters.includes(t.familyMember));
}

/**
 * Apply category filter
 * Empty array means show all categories
 */
export function filterByCategory(
  transactions: Transaction[],
  categoryFilters: string[]
): Transaction[] {
  if (categoryFilters.length === 0) {
    return transactions; // Show all when no categories selected
  }
  return transactions.filter(t => categoryFilters.includes(t.category));
}

/**
 * Apply all filters to transaction list
 * This is the main entry point that orchestrates all filters
 */
export function applyTransactionFilters(
  transactions: Transaction[],
  filters: TransactionFilterState,
  months: MonthData[],
  getTransactionsForMonth: (start: Date, end: Date) => Transaction[]
): Transaction[] {
  // Apply filters in sequence
  let filtered = filterByMonth(transactions, filters.month, months, getTransactionsForMonth);
  filtered = filterByType(filtered, filters.types);
  filtered = filterByMember(filtered, filters.members);
  filtered = filterByCategory(filtered, filters.categories);
  
  return filtered;
}

/**
 * Create initial filter state
 * Empty arrays mean "show all" for that filter
 */
export function createInitialFilterState(initialMonthIndex: number = 0): TransactionFilterState {
  return {
    types: [], // Empty = show all
    members: [], // Empty = show all
    month: `carousel-${initialMonthIndex}`,
    categories: [], // Empty = show all
  };
}

/**
 * Reset all filters except month
 * Useful when changing months in the carousel
 */
export function resetFiltersExceptMonth(
  _currentFilters: TransactionFilterState,
  newMonthFilter: string
): TransactionFilterState {
  return {
    types: [], // Empty = show all
    members: [], // Empty = show all
    month: newMonthFilter,
    categories: [], // Empty = show all
  };
}

/** A titled list of category names for the filter UI */
export interface CategoryGroup {
  type: 'income' | 'expense';
  label: string;
  categories: string[];
}

/**
 * Categories present in these transactions, grouped by type and limited to the selected
 * transaction types (none selected = both). Expenses come first; empty groups are left out.
 */
export function getCategoryGroups(
  transactions: Transaction[],
  selectedTypes: ('income' | 'expense')[]
): CategoryGroup[] {
  const byType: Record<'income' | 'expense', Set<string>> = { expense: new Set(), income: new Set() };
  transactions.forEach(t => {
    if (t.category) byType[t.type]?.add(t.category);
  });

  return (['expense', 'income'] as const)
    .filter(type => selectedTypes.length === 0 || selectedTypes.includes(type))
    .map(type => ({
      type,
      label: type === 'income' ? 'Income' : 'Expenses',
      categories: [...byType[type]].sort((a, b) => a.localeCompare(b)),
    }))
    .filter(group => group.categories.length > 0);
}

/** Every category name across the groups, once (a name can exist for both types, e.g. "Other") */
export function flattenCategoryGroups(groups: CategoryGroup[]): string[] {
  return [...new Set(groups.flatMap(group => group.categories))];
}
