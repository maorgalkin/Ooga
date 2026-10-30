import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PersonalBudgetService } from '../../src/services/personalBudgetService';
import { supabase } from '../../src/lib/supabase';
import type { BudgetConfiguration } from '../../src/types';
import type { PersonalBudget, CategoryConfig, GlobalBudgetSettings } from '../../src/types/budget';

// Mock Supabase client
vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  },
}));

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

const HOUSEHOLD_ID = 'household-1';

/**
 * Route supabase.from(table) to per-table chains. Every service call starts with the
 * household_members lookup, which resolves to HOUSEHOLD_ID unless a test overrides it.
 * Pass an array to hand out one chain per call (the last one repeats); tables not
 * listed (e.g. the categories sync) resolve to an empty list.
 */
const mockTables = (tables: Record<string, any>) => {
  const calls: Record<string, number> = {};
  vi.mocked(supabase.from).mockImplementation(((table: string) => {
    const entry = tables[table];
    if (Array.isArray(entry)) {
      calls[table] = (calls[table] ?? -1) + 1;
      return entry[Math.min(calls[table], entry.length - 1)];
    }
    if (entry) return entry;
    if (table === 'household_members') {
      return createMockChain({ data: { household_id: HOUSEHOLD_ID }, error: null });
    }
    return createMockChain({ data: [], error: null });
  }) as never);
};

describe('PersonalBudgetService', () => {
  const mockUserId = 'test-user-123';
  const mockBudgetConfig: BudgetConfiguration = {
    version: '1.0.0',
    lastUpdated: '2025-10-25T10:00:00Z',
    categories: {
      'Groceries': { monthlyLimit: 500, warningThreshold: 80, isActive: true },
      'Rent': { monthlyLimit: 1500, warningThreshold: 80, isActive: true },
      'Entertainment': { monthlyLimit: 200, warningThreshold: 80, isActive: true },
    },
    globalSettings: {
      currency: 'USD',
      warningNotifications: true,
      emailAlerts: false,
    },
  };

  const mockPersonalBudget: PersonalBudget = {
    id: 'budget-1',
    user_id: mockUserId,
    version: 1,
    name: 'My Personal Budget',
    categories: mockBudgetConfig.categories as Record<string, CategoryConfig>,
    global_settings: {
      currency: 'USD',
      warningNotifications: true,
      emailAlerts: false,
      familyMembers: [
        { id: '1', name: 'Alice', color: '#FF5733' },
        { id: '2', name: 'Bob', color: '#33FF57' },
      ],
      activeExpenseCategories: ['Groceries', 'Rent', 'Entertainment'],
    },
    created_at: '2025-10-25T10:00:00Z',
    updated_at: '2025-10-25T10:00:00Z',
    is_active: true,
    notes: 'Initial budget',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock authenticated user
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: mockUserId } as any },
      error: null,
    });
  });

  describe('getActiveBudget', () => {
    it('should return the active personal budget', async () => {
      const mockChain = createMockChain({
        data: mockPersonalBudget,
        error: null,
      });

      mockTables({ personal_budgets: mockChain });

      const result = await PersonalBudgetService.getActiveBudget();

      expect(supabase.from).toHaveBeenCalledWith('personal_budgets');
      expect(mockChain.select).toHaveBeenCalledWith('*');
      expect(mockChain.eq).toHaveBeenCalledWith('household_id', HOUSEHOLD_ID);
      expect(mockChain.eq).toHaveBeenCalledWith('is_active', true);
      expect(result).toEqual(mockPersonalBudget);
    });

    it('should return null when no active budget exists', async () => {
      const mockChain = createMockChain({
        data: null,
        error: { code: 'PGRST116', message: 'No rows returned' },
      });

      mockTables({ personal_budgets: mockChain });

      const result = await PersonalBudgetService.getActiveBudget();

      expect(result).toBeNull();
    });

    it('should throw error when database query fails', async () => {
      const mockChain = createMockChain({
        data: null,
        error: { code: 'DATABASE_ERROR', message: 'Connection failed' },
      });

      mockTables({ personal_budgets: mockChain });

      await expect(PersonalBudgetService.getActiveBudget()).rejects.toThrow(
        'Connection failed'
      );
    });
  });

  describe('getBudgetHistory', () => {
    it('should return budget history ordered by version descending', async () => {
      const mockBudgets = [
        { ...mockPersonalBudget, id: 'budget-3', version: 3, is_active: true },
        { ...mockPersonalBudget, id: 'budget-2', version: 2, is_active: false },
        { ...mockPersonalBudget, id: 'budget-1', version: 1, is_active: false },
      ];

      const mockChain = createMockChain({
        data: mockBudgets,
        error: null,
      });

      mockTables({ personal_budgets: mockChain });

      const result = await PersonalBudgetService.getBudgetHistory();

      expect(supabase.from).toHaveBeenCalledWith('personal_budgets');
      expect(mockChain.order).toHaveBeenCalledWith('version', { ascending: false });
      expect(result).toEqual(mockBudgets);
    });
  });

  describe('createBudget', () => {
    it('should create a new personal budget with version 1', async () => {
      const newBudget = { ...mockPersonalBudget, id: 'new-budget' };

      const mockChain = createMockChain({
        data: newBudget,  // single object, not array
        error: null,
      });

      mockTables({ personal_budgets: mockChain });

      const result = await PersonalBudgetService.createBudget({
        name: 'My First Budget',
        categories: mockBudgetConfig.categories as Record<string, CategoryConfig>,
        global_settings: mockPersonalBudget.global_settings,
        notes: 'Starting fresh'
      });

      expect(result).toEqual(newBudget);
    });

    it('should throw error when insert fails', async () => {
      const mockChain = createMockChain({
        data: null,
        error: { message: 'Insert failed' },
      });

      mockTables({ personal_budgets: mockChain });

      await expect(
        PersonalBudgetService.createBudget({
          name: 'Test Budget',
          categories: mockBudgetConfig.categories as Record<string, CategoryConfig>,
          global_settings: mockPersonalBudget.global_settings
        })
      ).rejects.toThrow('Insert failed');  // Updated to match actual error
    });
  });

  describe('updateBudget', () => {
    it('should create a new version of the budget', async () => {
      const currentBudget = mockPersonalBudget;
      const updatedCategories = {
        ...mockBudgetConfig.categories,
        'Groceries': { monthlyLimit: 600, warningThreshold: 80, isActive: true },
      };
      const updatedBudget = {
        ...mockPersonalBudget,
        id: 'budget-2',
        version: 2,
        categories: updatedCategories,
      };

      const mockChain = createMockChain({
        data: updatedBudget,  // single object
        error: null,
      });

      mockTables({ personal_budgets: mockChain });

      const result = await PersonalBudgetService.updateBudget(
        currentBudget.id,
        { categories: updatedCategories, name: 'Updated groceries limit' }
      );

      expect(result.version).toBe(2);
    });
  });

  describe('setActiveBudget', () => {
    it('should set a different budget version as active', async () => {
      const targetBudget = { ...mockPersonalBudget, id: 'budget-2', version: 2 };

      const mockChain = createMockChain({
        data: { ...targetBudget, is_active: true },  // single object
        error: null,
      });

      mockTables({ personal_budgets: mockChain });

      const result = await PersonalBudgetService.setActiveBudget('budget-2');

      expect(result.is_active).toBe(true);
      expect(result.id).toBe('budget-2');
    });
  });

  describe('deleteBudget', () => {
    it('should delete a non-active budget version', async () => {
      const budgetToDelete = { ...mockPersonalBudget, is_active: false };

      const mockChain = createMockChain({
        data: budgetToDelete,
        error: null,
      });

      mockTables({ personal_budgets: mockChain });

      await expect(
        PersonalBudgetService.deleteBudget('budget-1')
      ).resolves.not.toThrow();
    });

    it('should activate another version before deleting the active budget', async () => {
      const activeBudget = { ...mockPersonalBudget, is_active: true };
      const otherBudget = { ...mockPersonalBudget, id: 'budget-2', is_active: false };

      // personal_budgets calls in order: getBudgetHistory, getBudgetById, then the
      // writes (deactivate all, activate budget-2, delete budget-1)
      const writes = createMockChain({ data: { ...otherBudget, is_active: true }, error: null });
      mockTables({
        personal_budgets: [
          createMockChain({ data: [activeBudget, otherBudget], error: null }),
          createMockChain({ data: activeBudget, error: null }),
          writes,
        ],
      });

      await expect(PersonalBudgetService.deleteBudget('budget-1')).resolves.toBeUndefined();

      expect(writes.update).toHaveBeenCalledWith({ is_active: true });
      expect(writes.eq).toHaveBeenCalledWith('id', 'budget-2');
      expect(writes.delete).toHaveBeenCalled();
      expect(writes.eq).toHaveBeenCalledWith('id', 'budget-1');
    });
  });

  describe('migrateFromLegacyConfig', () => {
    it('should create a personal budget from legacy config', async () => {
      const newBudget = { ...mockPersonalBudget, name: 'Migrated Budget' };

      const mockChain = createMockChain({
        data: newBudget,  // single object
        error: null,
      });

      mockTables({ personal_budgets: mockChain });

      const result = await PersonalBudgetService.migrateFromLegacyConfig(
        mockBudgetConfig
      );

      expect(result.name).toBe('Migrated Budget');
      expect(result.version).toBe(1);
    });
  });

  describe('addCategoryToActiveBudget', () => {
    const activeBudget = { ...mockPersonalBudget, household_id: HOUSEHOLD_ID };
    const pets: CategoryConfig = { monthlyLimit: 150, warningThreshold: 80, isActive: true, color: '#10B981' };

    it('adds a new category to the active budget so the transaction forms can offer it', async () => {
      const readChain = createMockChain({ data: activeBudget, error: null });
      const writeChain = createMockChain({ data: null, error: null });
      mockTables({ personal_budgets: [readChain, writeChain] });

      await PersonalBudgetService.addCategoryToActiveBudget('Pets', pets);

      expect(writeChain.update).toHaveBeenCalledWith({
        categories: { ...activeBudget.categories, Pets: pets },
        global_settings: {
          ...activeBudget.global_settings,
          activeExpenseCategories: ['Groceries', 'Rent', 'Entertainment', 'Pets'],
        },
      });
      expect(writeChain.eq).toHaveBeenCalledWith('id', 'budget-1');
      expect(writeChain.eq).toHaveBeenCalledWith('household_id', HOUSEHOLD_ID);
    });

    it('leaves the budget alone when it already lists the category', async () => {
      const readChain = createMockChain({ data: activeBudget, error: null });
      const writeChain = createMockChain({ data: null, error: null });
      mockTables({ personal_budgets: [readChain, writeChain] });

      await PersonalBudgetService.addCategoryToActiveBudget('Groceries', pets);

      expect(writeChain.update).not.toHaveBeenCalled();
    });

    it('treats a category named like an Object.prototype key as new', async () => {
      const readChain = createMockChain({ data: activeBudget, error: null });
      const writeChain = createMockChain({ data: null, error: null });
      mockTables({ personal_budgets: [readChain, writeChain] });

      await PersonalBudgetService.addCategoryToActiveBudget('constructor', pets);

      expect(writeChain.update).toHaveBeenCalledWith(expect.objectContaining({
        categories: { ...activeBudget.categories, constructor: pets },
      }));
    });

    it('does nothing when the household has no active budget', async () => {
      const readChain = createMockChain({ data: null, error: { code: 'PGRST116' } });
      mockTables({ personal_budgets: readChain });

      await PersonalBudgetService.addCategoryToActiveBudget('Pets', pets);

      expect(readChain.update).not.toHaveBeenCalled();
    });
  });

  describe('helper methods', () => {
    it('getTotalMonthlyLimit should calculate total of active categories', () => {
      const total = PersonalBudgetService.getTotalMonthlyLimit(mockPersonalBudget);
      
      // 500 (Groceries) + 1500 (Rent) + 200 (Entertainment) = 2200
      expect(total).toBe(2200);
    });

    it('getActiveCategoryCount should count active categories', () => {
      const count = PersonalBudgetService.getActiveCategoryCount(mockPersonalBudget);
      
      expect(count).toBe(3);
    });

    it('getActiveCategoryCount should exclude inactive categories', () => {
      const budgetWithInactive = {
        ...mockPersonalBudget,
        categories: {
          ...mockPersonalBudget.categories,
          'Inactive': { monthlyLimit: 100, warningThreshold: 80, isActive: false },
        },
      };

      const count = PersonalBudgetService.getActiveCategoryCount(budgetWithInactive);
      
      expect(count).toBe(3); // Still 3, not 4
    });
  });
});
