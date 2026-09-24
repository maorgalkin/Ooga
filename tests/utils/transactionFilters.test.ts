import { describe, it, expect } from 'vitest';
import type { Transaction } from '../../src/types';
import type { MonthData } from '../../src/utils/transactionFilters';
import {
  filterByMonth,
  filterByType,
  filterByMember,
  filterByCategory,
  applyTransactionFilters,
  createInitialFilterState,
  resetFiltersExceptMonth,
  getCategoryGroups,
  flattenCategoryGroups,
} from '../../src/utils/transactionFilters';

// Helper to create mock transactions
const createTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'test-id',
  date: '2026-01-15',
  amount: 100,
  category: 'Groceries',
  type: 'expense',
  familyMember: 'member-1',
  description: 'Test transaction',
  ...overrides,
});

// Helper to create mock month data
const createMonthData = (year: number, month: number): MonthData => {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0, 23, 59, 59);
  const monthName = start.toLocaleDateString('en-US', { month: 'long' });
  
  return {
    label: `${monthName} ${year}`,
    monthName,
    year: year.toString(),
    start,
    end,
  };
};

describe('transactionFilters', () => {
  describe('filterByType', () => {
    it('should return all transactions when filter array is empty', () => {
      const transactions = [
        createTransaction({ type: 'expense' }),
        createTransaction({ type: 'income' }),
      ];
      
      const result = filterByType(transactions, []);
      expect(result).toHaveLength(2);
    });
    
    it('should filter expense transactions', () => {
      const transactions = [
        createTransaction({ id: '1', type: 'expense' }),
        createTransaction({ id: '2', type: 'income' }),
        createTransaction({ id: '3', type: 'expense' }),
      ];
      
      const result = filterByType(transactions, ['expense']);
      expect(result).toHaveLength(2);
      expect(result.every(t => t.type === 'expense')).toBe(true);
    });
    
    it('should filter income transactions', () => {
      const transactions = [
        createTransaction({ id: '1', type: 'expense' }),
        createTransaction({ id: '2', type: 'income' }),
        createTransaction({ id: '3', type: 'income' }),
      ];
      
      const result = filterByType(transactions, ['income']);
      expect(result).toHaveLength(2);
      expect(result.every(t => t.type === 'income')).toBe(true);
    });
    
    it('should filter multiple types', () => {
      const transactions = [
        createTransaction({ id: '1', type: 'expense' }),
        createTransaction({ id: '2', type: 'income' }),
        createTransaction({ id: '3', type: 'expense' }),
      ];
      
      const result = filterByType(transactions, ['income', 'expense']);
      expect(result).toHaveLength(3);
    });
  });
  
  describe('filterByMember', () => {
    it('should return all transactions when filter array is empty', () => {
      const transactions = [
        createTransaction({ familyMember: 'member-1' }),
        createTransaction({ familyMember: 'member-2' }),
      ];
      
      const result = filterByMember(transactions, []);
      expect(result).toHaveLength(2);
    });
    
    it('should filter by specific family member', () => {
      const transactions = [
        createTransaction({ id: '1', familyMember: 'member-1' }),
        createTransaction({ id: '2', familyMember: 'member-2' }),
        createTransaction({ id: '3', familyMember: 'member-1' }),
      ];
      
      const result = filterByMember(transactions, ['member-1']);
      expect(result).toHaveLength(2);
      expect(result.every(t => t.familyMember === 'member-1')).toBe(true);
    });
    
    it('should filter multiple family members', () => {
      const transactions = [
        createTransaction({ id: '1', familyMember: 'member-1' }),
        createTransaction({ id: '2', familyMember: 'member-2' }),
        createTransaction({ id: '3', familyMember: 'member-3' }),
      ];
      
      const result = filterByMember(transactions, ['member-1', 'member-2']);
      expect(result).toHaveLength(2);
    });
  });
  
  describe('filterByCategory', () => {
    it('should return all transactions when filter array is empty', () => {
      const transactions = [
        createTransaction({ category: 'Groceries' }),
        createTransaction({ category: 'Entertainment' }),
      ];
      
      const result = filterByCategory(transactions, []);
      expect(result).toHaveLength(2);
    });
    
    it('should filter by specific category', () => {
      const transactions = [
        createTransaction({ id: '1', category: 'Groceries' }),
        createTransaction({ id: '2', category: 'Entertainment' }),
        createTransaction({ id: '3', category: 'Groceries' }),
      ];
      
      const result = filterByCategory(transactions, ['Groceries']);
      expect(result).toHaveLength(2);
      expect(result.every(t => t.category === 'Groceries')).toBe(true);
    });
    
    it('should filter multiple categories', () => {
      const transactions = [
        createTransaction({ id: '1', category: 'Groceries' }),
        createTransaction({ id: '2', category: 'Entertainment' }),
        createTransaction({ id: '3', category: 'Transport' }),
      ];
      
      const result = filterByCategory(transactions, ['Groceries', 'Entertainment']);
      expect(result).toHaveLength(2);
    });
  });
  
  describe('filterByMonth', () => {
    const months = [
      createMonthData(2026, 0), // January 2026
      createMonthData(2025, 11), // December 2025
    ];
    
    const transactions = [
      createTransaction({ id: '1', date: '2026-01-15' }),
      createTransaction({ id: '2', date: '2025-12-20' }),
      createTransaction({ id: '3', date: '2026-01-05' }),
    ];
    
    const getTransactionsForMonth = (start: Date, end: Date) => {
      return transactions.filter(t => {
        const d = new Date(t.date);
        return d >= start && d <= end;
      });
    };
    
    it('should filter by carousel index', () => {
      const result = filterByMonth(transactions, 'carousel-0', months, getTransactionsForMonth);
      expect(result).toHaveLength(2); // 2 transactions in Jan 2026
      expect(result.every(t => t.date.startsWith('2026-01'))).toBe(true);
    });
    
    it('should filter by YYYY-MM format', () => {
      const result = filterByMonth(transactions, '2025-12', months, getTransactionsForMonth);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('2');
    });
    
    it('should return empty array for invalid carousel index', () => {
      const result = filterByMonth(transactions, 'carousel-99', months, getTransactionsForMonth);
      expect(result).toHaveLength(0);
    });
    
    it('should return all transactions for invalid month format', () => {
      const result = filterByMonth(transactions, 'invalid', months, getTransactionsForMonth);
      expect(result).toHaveLength(3);
    });
    
    it('should return all transactions for malformed YYYY-MM', () => {
      const result = filterByMonth(transactions, '2026-13-01', months, getTransactionsForMonth);
      expect(result).toHaveLength(3);
    });
  });
  
  describe('applyTransactionFilters', () => {
    const months = [
      createMonthData(2026, 0), // January 2026
    ];
    
    const transactions = [
      createTransaction({ id: '1', date: '2026-01-10', type: 'expense', category: 'Groceries', familyMember: 'member-1' }),
      createTransaction({ id: '2', date: '2026-01-15', type: 'income', category: 'Salary', familyMember: 'member-1' }),
      createTransaction({ id: '3', date: '2026-01-20', type: 'expense', category: 'Entertainment', familyMember: 'member-2' }),
      createTransaction({ id: '4', date: '2025-12-25', type: 'expense', category: 'Groceries', familyMember: 'member-1' }),
    ];
    
    const getTransactionsForMonth = (start: Date, end: Date) => {
      return transactions.filter(t => {
        const d = new Date(t.date);
        return d >= start && d <= end;
      });
    };
    
    it('should apply all filters correctly', () => {
      const filters = {
        types: ['expense' as const],
        members: ['member-1'],
        month: 'carousel-0',
        categories: ['Groceries'],
      };
      
      const result = applyTransactionFilters(transactions, filters, months, getTransactionsForMonth);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });
    
    it('should return all month transactions when filter arrays are empty', () => {
      const filters = {
        types: [],
        members: [],
        month: 'carousel-0',
        categories: [],
      };
      
      const result = applyTransactionFilters(transactions, filters, months, getTransactionsForMonth);
      expect(result).toHaveLength(3); // 3 transactions in Jan 2026
    });
    
    it('should chain filters correctly', () => {
      const filters = {
        types: ['expense' as const],
        members: [],
        month: 'carousel-0',
        categories: [],
      };
      
      const result = applyTransactionFilters(transactions, filters, months, getTransactionsForMonth);
      expect(result).toHaveLength(2); // 2 expenses in Jan 2026
      expect(result.every(t => t.type === 'expense')).toBe(true);
    });
  });
  
  describe('createInitialFilterState', () => {
    it('should create initial state with default month index 0', () => {
      const state = createInitialFilterState();
      expect(state).toEqual({
        types: [],
        members: [],
        month: 'carousel-0',
        categories: [],
      });
    });
    
    it('should create initial state with custom month index', () => {
      const state = createInitialFilterState(3);
      expect(state).toEqual({
        types: [],
        members: [],
        month: 'carousel-3',
        categories: [],
      });
    });
  });
  
  describe('resetFiltersExceptMonth', () => {
    it('should reset all filters except month', () => {
      const currentFilters = {
        types: ['expense' as const],
        members: ['member-1'],
        month: 'carousel-2',
        categories: ['Groceries'],
      };
      
      const result = resetFiltersExceptMonth(currentFilters, 'carousel-3');
      expect(result).toEqual({
        types: [],
        members: [],
        month: 'carousel-3',
        categories: [],
      });
    });
  });
});

describe('getCategoryGroups', () => {
  const tx = (category: string, type: 'income' | 'expense'): Transaction => ({
    id: `${type}-${category}`, date: '2026-09-10', description: category, amount: 10, category, type,
  });
  const month = [
    tx('Groceries', 'expense'),
    tx('Dining', 'expense'),
    tx('Groceries', 'expense'),
    tx('Salary', 'income'),
    tx('Gift', 'income'),
    tx('Other', 'income'),
    tx('Other', 'expense'),
  ];

  it('lists both types, expenses first, when no type is selected', () => {
    expect(getCategoryGroups(month, [])).toEqual([
      { type: 'expense', label: 'Expenses', categories: ['Dining', 'Groceries', 'Other'] },
      { type: 'income', label: 'Income', categories: ['Gift', 'Other', 'Salary'] },
    ]);
  });

  it('follows the selected transaction type', () => {
    expect(getCategoryGroups(month, ['income']).map(g => g.type)).toEqual(['income']);
    expect(getCategoryGroups(month, ['expense']).map(g => g.type)).toEqual(['expense']);
    expect(getCategoryGroups(month, ['income', 'expense'])).toHaveLength(2);
  });

  it('leaves out a type with no categories this month', () => {
    expect(getCategoryGroups([tx('Salary', 'income')], [])).toEqual([
      { type: 'income', label: 'Income', categories: ['Salary'] },
    ]);
  });

  it('flattens to unique names', () => {
    expect(flattenCategoryGroups(getCategoryGroups(month, []))).toEqual(['Dining', 'Groceries', 'Other', 'Gift', 'Salary']);
  });
});
