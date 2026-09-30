import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MonthlyBudgetService } from '../../src/services/monthlyBudgetService';
import { PersonalBudgetService } from '../../src/services/personalBudgetService';
import { supabase } from '../../src/lib/supabase';
import type { MonthlyBudget, PersonalBudget } from '../../src/types/budget';

// Mock Supabase client
vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  },
}));

// Mock PersonalBudgetService
vi.mock('../../src/services/personalBudgetService');

// Helper to create a mock Supabase query chain
const createMockChain = (finalResult: any) => {
  const chain: any = {};
  
  // Create a result object that can act as both a promise and a chain
  const resultWithChain = {
    ...finalResult,
    then: (resolve: any) => Promise.resolve(finalResult).then(resolve),
    catch: (reject: any) => Promise.resolve(finalResult).catch(reject),
  };
  
  // All chainable methods return the chain itself for continued chaining
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.set = vi.fn().mockReturnValue(chain);
  
  // These can be either terminal or chainable
  chain.order = vi.fn().mockReturnValue(resultWithChain);  // often terminal
  chain.update = vi.fn().mockReturnValue(chain);  // needs to chain to .eq()
  chain.delete = vi.fn().mockReturnValue(chain);  // needs to chain to .eq()
  
  // Terminal methods resolve to the final result
  chain.single = vi.fn().mockResolvedValue(finalResult);
  chain.maybeSingle = vi.fn().mockResolvedValue(finalResult);
  
  // Make the chain itself thenable for direct awaiting
  chain.then = resultWithChain.then;
  chain.catch = resultWithChain.catch;
  
  return chain;
};

describe('MonthlyBudgetService', () => {
  const mockUserId = 'test-user-123';
  const mockHouseholdId = 'test-household-123';
  const mockPersonalBudget: PersonalBudget = {
    id: 'personal-budget-1',
    user_id: mockUserId,
    version: 1,
    name: 'My Budget',
    categories: {
      'Groceries': { monthlyLimit: 500, warningThreshold: 80, isActive: true },
      'Rent': { monthlyLimit: 1500, warningThreshold: 80, isActive: true },
    },
    global_settings: {
      currency: 'USD',
      warningNotifications: true,
      emailAlerts: false,
      familyMembers: [],
      activeExpenseCategories: ['Groceries', 'Rent'],
    },
    created_at: '2025-10-25T10:00:00Z',
    updated_at: '2025-10-25T10:00:00Z',
    is_active: true,
  };

  const mockMonthlyBudget: MonthlyBudget = {
    id: 'monthly-budget-1',
    user_id: mockUserId,
    personal_budget_id: 'personal-budget-1',
    year: 2025,
    month: 10,
    categories: mockPersonalBudget.categories,
    global_settings: mockPersonalBudget.global_settings,
    adjustment_count: 0,
    is_locked: false,
    created_at: '2025-10-25T10:00:00Z',
    updated_at: '2025-10-25T10:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: mockUserId } as any },
      error: null,
    });
  });

  describe('getOrCreateMonthlyBudget', () => {
    it('should return existing monthly budget if it exists', async () => {
      const mockChain = createMockChain({
        data: mockMonthlyBudget,
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue(mockChain);

      const result = await MonthlyBudgetService.getOrCreateMonthlyBudget(2025, 10);

      expect(result).toEqual(mockMonthlyBudget);
      expect(mockChain.eq).toHaveBeenCalledWith('year', 2025);
      expect(mockChain.eq).toHaveBeenCalledWith('month', 10);
    });

    it('should create new monthly budget from personal budget if not exists', async () => {
      // Mock get personal budget
      vi.mocked(PersonalBudgetService.getActiveBudget).mockResolvedValue(
        mockPersonalBudget
      );

      const mockHouseholdChain = createMockChain({
        data: { household_id: mockHouseholdId },
        error: null,
      });
      
      let budgetCallCount = 0;
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'household_members') return mockHouseholdChain;
        if (table === 'monthly_budgets') {
          budgetCallCount++;
          if (budgetCallCount === 1) {
            // First call: check if monthly budget exists - returns null
            return createMockChain({ data: null, error: null });
          } else {
            // Second call: insert new monthly budget
            return createMockChain({ data: mockMonthlyBudget, error: null });
          }
        }
        return createMockChain({ data: null, error: null });
      });

      const result = await MonthlyBudgetService.getOrCreateMonthlyBudget(2025, 10);

      expect(PersonalBudgetService.getActiveBudget).toHaveBeenCalled();
      expect(result).toBeTruthy();
    });

    it('should throw error if no personal budget exists', async () => {
      const mockHouseholdChain = createMockChain({
        data: { household_id: mockHouseholdId },
        error: null,
      });
      const mockBudgetChain = createMockChain({
        data: null,
        error: null,
      });

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'household_members') return mockHouseholdChain;
        if (table === 'monthly_budgets') return mockBudgetChain;
        return mockBudgetChain;
      });
      vi.mocked(PersonalBudgetService.getActiveBudget).mockResolvedValue(null);

      await expect(
        MonthlyBudgetService.getOrCreateMonthlyBudget(2025, 10)
      ).rejects.toThrow('No active personal budget found');
    });
  });

  describe('getCurrentMonthBudget', () => {
    it('should get budget for current month', async () => {
      const now = new Date('2025-10-25');
      vi.setSystemTime(now);

      const mockChain = createMockChain({
        data: mockMonthlyBudget,
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue(mockChain);

      const result = await MonthlyBudgetService.getCurrentMonthBudget();

      expect(result).toEqual(mockMonthlyBudget);
      expect(mockChain.eq).toHaveBeenCalledWith('year', 2025);
      expect(mockChain.eq).toHaveBeenCalledWith('month', 10);

      vi.useRealTimers();
    });
  });

  describe('updateCategoryLimit', () => {
    it('should update category limit and increment adjustment count', async () => {
      const updatedBudget = {
        ...mockMonthlyBudget,
        categories: {
          ...mockMonthlyBudget.categories,
          'Groceries': { ...mockMonthlyBudget.categories['Groceries'], monthlyLimit: 600 },
        },
        adjustment_count: 1,
      };

      let callCount = 0;
      vi.mocked(supabase.from).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call: get current budget
          return createMockChain({ data: mockMonthlyBudget, error: null });
        } else {
          // Second call: update budget
          return createMockChain({ data: updatedBudget, error: null });
        }
      });

      const result = await MonthlyBudgetService.updateCategoryLimit(
        'monthly-budget-1',
        'Groceries',
        600,
        'Increased for holidays'
      );

      expect(result.adjustment_count).toBe(1);
      expect(result.categories['Groceries'].monthlyLimit).toBe(600);
    });

    it('should throw error if category does not exist', async () => {
      const mockChain = createMockChain({
        data: mockMonthlyBudget,
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue(mockChain);

      await expect(
        MonthlyBudgetService.updateCategoryLimit(
          'monthly-budget-1',
          'NonExistentCategory',
          100
        )
      ).rejects.toThrow('Category "NonExistentCategory" not found');
    });
  });

  describe('lockMonthlyBudget', () => {
    it('should lock a monthly budget', async () => {
      const lockedBudget = { ...mockMonthlyBudget, is_locked: true };

      const mockChain = createMockChain({
        data: lockedBudget,
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue(mockChain);

      const result = await MonthlyBudgetService.lockMonthlyBudget(2025, 10);

      expect(result.is_locked).toBe(true);
    });
  });

  describe('compareToPersonalBudget', () => {
    it('should compare monthly budget to personal budget', async () => {
      const adjustedMonthly = {
        ...mockMonthlyBudget,
        categories: {
          'Groceries': { monthlyLimit: 600, warningThreshold: 80, isActive: true },
          'Rent': { monthlyLimit: 1500, warningThreshold: 80, isActive: true },
        },
        adjustment_count: 1,
      };

      const mockChain = createMockChain({
        data: adjustedMonthly,
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue(mockChain);

      // Mock get personal budget
      vi.mocked(PersonalBudgetService.getActiveBudget).mockResolvedValue(
        mockPersonalBudget
      );

      const result = await MonthlyBudgetService.compareToPersonalBudget(2025, 10);

      expect(result).toBeDefined();
      expect(result.totalPersonalLimit).toBe(2000); // 500 + 1500
      expect(result.totalMonthlyLimit).toBe(2100); // 600 + 1500
      expect(result.comparisons).toHaveLength(2);
      
      const groceries = result.comparisons.find(c => c.category === 'Groceries');
      expect(groceries?.personalLimit).toBe(500);
      expect(groceries?.monthlyLimit).toBe(600);
      expect(groceries?.difference).toBe(100);
      expect(groceries?.differencePercentage).toBeCloseTo(20, 1); // (600-500)/500 * 100
    });

    it('should throw error if monthly budget not found', async () => {
      const mockHouseholdChain = createMockChain({
        data: { household_id: mockHouseholdId },
        error: null,
      });
      const mockBudgetChain = createMockChain({
        data: null,
        error: null,
      });

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'household_members') return mockHouseholdChain;
        if (table === 'monthly_budgets') return mockBudgetChain;
        return mockBudgetChain;
      });

      await expect(
        MonthlyBudgetService.compareToPersonalBudget(2025, 10)
      ).rejects.toThrow('Monthly budget not found');
    });
  });

  describe('helper methods', () => {
    it('getTotalMonthlyLimit should calculate total limit', () => {
      const total = MonthlyBudgetService.getTotalMonthlyLimit(mockMonthlyBudget);
      
      expect(total).toBe(2000); // 500 + 1500
    });

    it('hasAdjustments should return true when adjustment_count > 0', () => {
      const adjusted = { ...mockMonthlyBudget, adjustment_count: 2 };
      
      expect(MonthlyBudgetService.hasAdjustments(adjusted)).toBe(true);
      expect(MonthlyBudgetService.hasAdjustments(mockMonthlyBudget)).toBe(false);
    });

    it('getMonthName should return correct month name', () => {
      expect(MonthlyBudgetService.getMonthName(1)).toBe('January');
      expect(MonthlyBudgetService.getMonthName(10)).toBe('October');
      expect(MonthlyBudgetService.getMonthName(12)).toBe('December');
    });

    it('formatMonthYear should format correctly', () => {
      expect(MonthlyBudgetService.formatMonthYear(2025, 10)).toBe('October 2025');
      expect(MonthlyBudgetService.formatMonthYear(2024, 1)).toBe('January 2024');
    });
  });
});
