import { supabase } from '../lib/supabase';
import type {
  PersonalBudget,
  CategoryConfig,
  GlobalBudgetSettings
} from '../types/budget';
import type { BudgetConfiguration } from '../types';

// Helper to get current user's household ID
const getHouseholdId = async (): Promise<string> => {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .single();

  if (error || !data) {
    throw new Error('User is not part of a household');
  }

  return data.household_id;
};

/**
 * Sync budget categories to the categories table
 * This ensures the categories table stays in sync with personal_budgets.categories JSONB
 * Uses upsert to create new categories or update existing ones
 */
const syncCategoriesToTable = async (
  categories: Record<string, CategoryConfig>,
  householdId: string,
  userId: string
): Promise<void> => {
  if (!categories || Object.keys(categories).length === 0) {
    return;
  }

  // Get existing categories for this household
  const { data: existingCategories, error: fetchError } = await supabase
    .from('categories')
    .select('id, name')
    .eq('household_id', householdId);

  if (fetchError) {
    console.error('Error fetching existing categories:', fetchError);
    // Don't throw - this is a sync operation, budget creation should still succeed
    return;
  }

  const existingByName = new Map(
    (existingCategories || []).map(c => [c.name.toLowerCase(), c.id])
  );

  // Prepare categories for upsert
  const categoriesToUpsert = Object.entries(categories).map(([name, config], index) => {
    const existingId = existingByName.get(name.toLowerCase());
    return {
      ...(existingId && { id: existingId }), // Include ID if updating
      user_id: userId,
      household_id: householdId,
      name: name,
      type: 'expense' as const,
      color: config.color || '#3B82F6',
      monthly_limit: config.monthlyLimit || 0,
      warning_threshold: config.warningThreshold || 80,
      is_active: config.isActive ?? true,
      sort_order: index,
      is_system: false,
    };
  });

  // Split into inserts (no id) and updates (has id)
  const toInsert = categoriesToUpsert.filter(c => !('id' in c));
  const toUpdate = categoriesToUpsert.filter(c => 'id' in c);

  // Insert new categories
  if (toInsert.length > 0) {
    const { error: insertError } = await supabase
      .from('categories')
      .insert(toInsert);

    if (insertError) {
      console.error('Error inserting categories:', insertError);
      // Don't throw - budget creation should still succeed
    }
  }

  // Update existing categories
  for (const cat of toUpdate) {
    const { id, ...updateData } = cat;
    const { error: updateError } = await supabase
      .from('categories')
      .update(updateData)
      .eq('id', id);

    if (updateError) {
      console.error(`Error updating category ${cat.name}:`, updateError);
    }
  }
};

/**
 * Personal Budget Service
 * Manages user's baseline/ideal budget configuration
 * Serves as the reference point for all monthly budgets
 */
export class PersonalBudgetService {
  /**
   * Get the active personal budget for the current user
   */
  static async getActiveBudget(): Promise<PersonalBudget | null> {
    try {
      const householdId = await getHouseholdId();

      const { data, error } = await supabase
        .from('personal_budgets')
        .select('*')
        .eq('household_id', householdId)
        .eq('is_active', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No active budget found
          return null;
        }
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error fetching active personal budget:', error);
      throw error;
    }
  }

  /**
   * Get all personal budget versions for the current user
   * Returns budgets ordered by version descending
   */
  static async getBudgetHistory(): Promise<PersonalBudget[]> {
    try {
      const householdId = await getHouseholdId();

      const { data, error } = await supabase
        .from('personal_budgets')
        .select('*')
        .eq('household_id', householdId)
        .order('version', { ascending: false});

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching personal budget history:', error);
      throw error;
    }
  }

  /**
   * Get a specific personal budget by ID
   */
  static async getBudgetById(budgetId: string): Promise<PersonalBudget | null> {
    try {
      const householdId = await getHouseholdId();

      const { data, error } = await supabase
        .from('personal_budgets')
        .select('*')
        .eq('id', budgetId)
        .eq('household_id', householdId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error fetching personal budget by ID:', error);
      throw error;
    }
  }

  /**
   * Create a new personal budget
   * This is typically done during onboarding or when creating a new baseline
   * Also syncs categories to the categories table for consistency
   */
  static async createBudget(
    budget: Omit<PersonalBudget, 'id' | 'user_id' | 'version' | 'created_at' | 'updated_at' | 'is_active' | 'household_id'>
  ): Promise<PersonalBudget> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const householdId = await getHouseholdId();

      // Deactivate any existing active budget
      await this.deactivateAllBudgets();

      // Get next version number
      const nextVersion = await this.getNextVersion();

      const newBudget: Omit<PersonalBudget, 'id' | 'created_at' | 'updated_at'> = {
        user_id: user.id,
        household_id: householdId,
        version: nextVersion,
        name: budget.name,
        categories: budget.categories,
        global_settings: budget.global_settings,
        is_active: true,
        ...(budget.notes && { notes: budget.notes }) // Only include notes if not empty
      };

      const { data, error } = await supabase
        .from('personal_budgets')
        .insert([newBudget])
        .select()
        .single();

      if (error) {
        console.error('Supabase error creating budget:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        console.error('Budget data being inserted:', JSON.stringify(newBudget, null, 2));
        throw error;
      }

      // Sync categories to the categories table
      await syncCategoriesToTable(budget.categories, householdId, user.id);

      return data;
    } catch (error) {
      console.error('Error creating personal budget:', error);
      throw error;
    }
  }

  /**
   * Update the active personal budget (creates a new version)
   * This is called when scheduled adjustments are applied
   * Also syncs categories to the categories table for consistency
   */
  static async updateBudget(
    budgetId: string,
    updates: Partial<PersonalBudget>
  ): Promise<PersonalBudget> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const householdId = await getHouseholdId();

      // Get the existing budget
      const existingBudget = await this.getBudgetById(budgetId);
      
      if (!existingBudget) {
        throw new Error('Budget not found');
      }

      // Deactivate all budgets
      await this.deactivateAllBudgets();

      // Get next version number
      const nextVersion = await this.getNextVersion();

      // Merge categories - use updates if provided, otherwise existing
      const finalCategories = updates.categories ?? existingBudget.categories;

      // Create new version with updates
      const newBudget: Omit<PersonalBudget, 'id' | 'created_at' | 'updated_at'> = {
        user_id: user.id,
        household_id: householdId,
        version: nextVersion,
        name: updates.name ?? existingBudget.name,
        categories: finalCategories,
        global_settings: updates.global_settings ?? existingBudget.global_settings,
        is_active: true,
        notes: updates.notes ?? existingBudget.notes
      };

      const { data, error } = await supabase
        .from('personal_budgets')
        .insert([newBudget])
        .select()
        .single();

      if (error) throw error;

      // Sync categories to the categories table
      await syncCategoriesToTable(finalCategories, householdId, user.id);

      return data;
    } catch (error) {
      console.error('Error updating personal budget:', error);
      throw error;
    }
  }

  /**
   * Update budget metadata (name, notes) without creating new version
   */
  static async updateBudgetMetadata(
    budgetId: string,
    updates: {
      name?: string;
      notes?: string;
    }
  ): Promise<PersonalBudget> {
    try {
      const householdId = await getHouseholdId();

      const { data, error } = await supabase
        .from('personal_budgets')
        .update(updates)
        .eq('id', budgetId)
        .eq('household_id', householdId)
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error updating budget metadata:', error);
      throw error;
    }
  }

  /**
   * Set a specific budget version as active
   * Deactivates all other budgets
   */
  static async setActiveBudget(budgetId: string): Promise<PersonalBudget> {
    try {
      const householdId = await getHouseholdId();

      // Deactivate all budgets
      await this.deactivateAllBudgets();

      // Activate the specified budget
      const { data, error } = await supabase
        .from('personal_budgets')
        .update({ is_active: true })
        .eq('id', budgetId)
        .eq('household_id', householdId)
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error setting active budget:', error);
      throw error;
    }
  }

  /**
   * Delete a personal budget
   * Allows deleting any budget, including the last one (returns user to no-budget state)
   */
  static async deleteBudget(budgetId: string): Promise<void> {
    try {
      const householdId = await getHouseholdId();

      // Get all budgets to check if we need to activate another one
      const allBudgets = await this.getBudgetHistory();
      
      // Check if this budget is active
      const budget = await this.getBudgetById(budgetId);
      if (budget?.is_active && allBudgets.length > 1) {
        // Find another budget to activate (only if there are other budgets)
        const otherBudget = allBudgets.find(b => b.id !== budgetId);
        if (otherBudget) {
          await this.setActiveBudget(otherBudget.id);
        }
      }

      const { error } = await supabase
        .from('personal_budgets')
        .delete()
        .eq('id', budgetId)
        .eq('household_id', householdId);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting personal budget:', error);
      throw error;
    }
  }

  /**
   * Convert legacy budget configuration to personal budget
   * Used for migration from old budget_configs table
   */
  static async migrateFromLegacyConfig(
    legacyConfig: BudgetConfiguration
  ): Promise<PersonalBudget> {
    try {
      // Check if personal budget already exists
      const existing = await this.getActiveBudget();
      if (existing) {
        return existing;
      }

      return await this.createBudget({
        name: 'Personal Budget',
        categories: legacyConfig.categories as Record<string, CategoryConfig>,
        global_settings: legacyConfig.globalSettings as GlobalBudgetSettings,
        notes: 'Migrated from legacy configuration'
      });
    } catch (error) {
      console.error('Error migrating from legacy config:', error);
      throw error;
    }
  }

  /**
   * Get the next version number for a new budget
   */
  private static async getNextVersion(): Promise<number> {
    try {
      const householdId = await getHouseholdId();

      const { data, error } = await supabase
        .from('personal_budgets')
        .select('version')
        .eq('household_id', householdId)
        .order('version', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No budgets exist, start with version 1
          return 1;
        }
        throw error;
      }

      return (data?.version || 0) + 1;
    } catch (error) {
      console.error('Error getting next version:', error);
      return 1; // Default to version 1 if error
    }
  }

  /**
   * Deactivate all personal budgets for the current user
   */
  private static async deactivateAllBudgets(): Promise<void> {
    try {
      const householdId = await getHouseholdId();

      const { error } = await supabase
        .from('personal_budgets')
        .update({ is_active: false })
        .eq('household_id', householdId)
        .eq('is_active', true);

      if (error) throw error;
    } catch (error) {
      console.error('Error deactivating budgets:', error);
      throw error;
    }
  }

  /**
   * Get total monthly limit across all categories
   */
  static getTotalMonthlyLimit(budget: PersonalBudget): number {
    return Object.values(budget.categories)
      .filter(cat => cat.isActive)
      .reduce((sum, cat) => sum + cat.monthlyLimit, 0);
  }

  /**
   * Get count of active categories
   */
  static getActiveCategoryCount(budget: PersonalBudget): number {
    return Object.values(budget.categories).filter(cat => cat.isActive).length;
  }

  /**
   * Reset ALL budget configuration - deletes ALL personal budgets
   * This brings the user back to the default state (no configured budget)
   * 
   * @param options.includeMonthlyBudgets - Also delete all monthly budgets (default: false)
   * @param options.includeTransactions - Also delete all transactions (default: false)
   * @returns Number of budgets deleted
   */
  static async resetAllBudgets(options?: {
    includeMonthlyBudgets?: boolean;
    includeTransactions?: boolean;
  }): Promise<{ budgetsDeleted: number; monthlyBudgetsDeleted?: number; transactionsDeleted?: number }> {
    try {
      const householdId = await getHouseholdId();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Get count of budgets to delete
      const allBudgets = await this.getBudgetHistory();
      const budgetCount = allBudgets.length;

      // Delete all personal budgets
      const { error: budgetError } = await supabase
        .from('personal_budgets')
        .delete()
        .eq('household_id', householdId);

      if (budgetError) throw budgetError;

      const result: { budgetsDeleted: number; monthlyBudgetsDeleted?: number; transactionsDeleted?: number } = {
        budgetsDeleted: budgetCount
      };

      // Optionally delete monthly budgets
      if (options?.includeMonthlyBudgets) {
        const { data: monthlyBudgets, error: fetchError } = await supabase
          .from('monthly_budgets')
          .select('id')
          .eq('household_id', householdId);

        if (fetchError) throw fetchError;

        const { error: monthlyError } = await supabase
          .from('monthly_budgets')
          .delete()
          .eq('household_id', householdId);

        if (monthlyError) throw monthlyError;

        result.monthlyBudgetsDeleted = monthlyBudgets?.length || 0;
      }

      // Optionally delete transactions
      if (options?.includeTransactions) {
        const { data: transactions, error: fetchError } = await supabase
          .from('transactions')
          .select('id')
          .eq('household_id', householdId);

        if (fetchError) throw fetchError;

        const { error: transError } = await supabase
          .from('transactions')
          .delete()
          .eq('household_id', householdId);

        if (transError) throw transError;

        result.transactionsDeleted = transactions?.length || 0;
      }

      return result;
    } catch (error) {
      console.error('Error resetting budgets:', error);
      throw error;
    }
  }

  /**
   * Rename a category in all personal budgets
   * Updates the key in the categories JSONB object AND in global_settings.activeExpenseCategories
   */
  static async renameCategoryInAllBudgets(
    oldName: string,
    newName: string
  ): Promise<void> {
    try {
      const householdId = await getHouseholdId();

      // Get all personal budgets for this household
      const { data: budgets, error: fetchError } = await supabase
        .from('personal_budgets')
        .select('*')
        .eq('household_id', householdId);

      if (fetchError) throw fetchError;
      if (!budgets || budgets.length === 0) return;

      // Update each budget that has the old category name
      for (const budget of budgets) {
        const updates: { categories?: Record<string, unknown>; global_settings?: Record<string, unknown> } = {};
        
        // Update categories JSONB key
        if (budget.categories && budget.categories[oldName]) {
          const updatedCategories = { ...budget.categories };
          // Copy the category data to the new key
          updatedCategories[newName] = updatedCategories[oldName];
          // Delete the old key
          delete updatedCategories[oldName];
          updates.categories = updatedCategories;
        }
        
        // Update activeExpenseCategories in global_settings
        if (budget.global_settings?.activeExpenseCategories) {
          const activeCategories = budget.global_settings.activeExpenseCategories as string[];
          const oldIndex = activeCategories.indexOf(oldName);
          if (oldIndex !== -1) {
            const updatedActiveCategories = [...activeCategories];
            updatedActiveCategories[oldIndex] = newName;
            updates.global_settings = {
              ...budget.global_settings,
              activeExpenseCategories: updatedActiveCategories,
            };
          }
        }
        
        // Only update if there are changes
        if (Object.keys(updates).length > 0) {
          const { error: updateError } = await supabase
            .from('personal_budgets')
            .update(updates)
            .eq('id', budget.id);

          if (updateError) {
            console.error(`Error updating personal budget ${budget.id}:`, updateError);
          }
        }
      }
    } catch (error) {
      console.error('Error renaming category in personal budgets:', error);
      throw error;
    }
  }

  /**
   * Rename a category in all transactions
   * Updates the category string column
   */
  static async renameCategoryInTransactions(
    oldName: string,
    newName: string
  ): Promise<number> {
    try {
      const householdId = await getHouseholdId();

      // Update all transactions with the old category name
      const { data, error } = await supabase
        .from('transactions')
        .update({ category: newName })
        .eq('household_id', householdId)
        .eq('category', oldName)
        .select('id');

      if (error) throw error;

      return data?.length || 0;
    } catch (error) {
      console.error('Error renaming category in transactions:', error);
      throw error;
    }
  }

  /**
   * Update a category's properties (color, warningThreshold, monthlyLimit) in all personal budgets
   * This syncs the categories table changes to the personal_budgets.categories JSONB
   */
  static async updateCategoryInAllBudgets(
    categoryName: string,
    updates: { color?: string; warningThreshold?: number; monthlyLimit?: number }
  ): Promise<void> {
    try {
      const householdId = await getHouseholdId();

      // Get all personal budgets for this household
      const { data: budgets, error: fetchError } = await supabase
        .from('personal_budgets')
        .select('*')
        .eq('household_id', householdId);

      if (fetchError) throw fetchError;
      if (!budgets || budgets.length === 0) return;

      // Filter out undefined values
      const cleanUpdates: Record<string, unknown> = {};
      if (updates.color !== undefined) cleanUpdates.color = updates.color;
      if (updates.warningThreshold !== undefined) cleanUpdates.warningThreshold = updates.warningThreshold;
      if (updates.monthlyLimit !== undefined) cleanUpdates.monthlyLimit = updates.monthlyLimit;

      if (Object.keys(cleanUpdates).length === 0) return;

      // Update each budget that has this category
      for (const budget of budgets) {
        if (budget.categories && budget.categories[categoryName]) {
          const updatedCategories = { ...budget.categories };
          updatedCategories[categoryName] = {
            ...updatedCategories[categoryName],
            ...cleanUpdates,
          };

          const { error: updateError } = await supabase
            .from('personal_budgets')
            .update({ categories: updatedCategories })
            .eq('id', budget.id);

          if (updateError) {
            console.error(`Error updating personal budget ${budget.id}:`, updateError);
          }
        }
      }
    } catch (error) {
      console.error('Error updating category in personal budgets:', error);
      throw error;
    }
  }

  /**
   * Add a newly created expense category to the active personal budget.
   * The transaction forms list categories from the active budget, so a category that only
   * exists in the categories table can't be picked there. Does nothing when there is no
   * active budget or the budget already lists the category.
   */
  static async addCategoryToActiveBudget(categoryName: string, config: CategoryConfig): Promise<void> {
    const budget = await PersonalBudgetService.getActiveBudget();
    if (!budget) return;

    const active = budget.global_settings?.activeExpenseCategories ?? [];
    // Own keys only: a category named "constructor" must not match Object.prototype
    const existing = Object.hasOwn(budget.categories ?? {}, categoryName) ? budget.categories[categoryName] : undefined;
    if (existing && active.includes(categoryName)) return;

    const { error } = await supabase
      .from('personal_budgets')
      .update({
        categories: { ...budget.categories, [categoryName]: existing ?? config },
        global_settings: {
          ...budget.global_settings,
          activeExpenseCategories: active.includes(categoryName) ? active : [...active, categoryName],
        },
      })
      .eq('id', budget.id)
      .eq('household_id', budget.household_id);

    if (error) {
      console.error('Error adding category to the active budget:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const personalBudgetService = PersonalBudgetService;
