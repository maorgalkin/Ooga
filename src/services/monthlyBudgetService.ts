import { supabase } from '../lib/supabase';
import { PersonalBudgetService } from './personalBudgetService';
import type {
  MonthlyBudget,
  PersonalBudget,
  BudgetComparisonResult,
  BudgetComparisonSummary
} from '../types/budget';

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
 * Monthly Budget Service
 * Manages budgets for specific months
 * Auto-creates from personal budget, tracks adjustments
 */
export class MonthlyBudgetService {
  /**
   * Get or create monthly budget for a specific month
   * If doesn't exist, creates from active personal budget
   */
  static async getOrCreateMonthlyBudget(
    year: number,
    month: number
  ): Promise<MonthlyBudget> {
    try {
      // Try to get existing monthly budget
      const existing = await this.getMonthlyBudget(year, month);
      if (existing) {
        return existing;
      }

      // Create new monthly budget from personal budget
      return await this.createMonthlyBudget(year, month);
    } catch (error) {
      console.error('Error getting or creating monthly budget:', error);
      throw error;
    }
  }

  /**
   * Sync monthly budget with personal budget
   * Returns a synced copy without modifying the database
   * @param monthlyBudget - The monthly budget to sync
   * @param addNewCategories - Whether to add categories from personal budget that don't exist in monthly budget
   */
  private static async syncWithPersonalBudget(
    monthlyBudget: MonthlyBudget,
    addNewCategories: boolean = false
  ): Promise<MonthlyBudget> {
    const personalBudget = await PersonalBudgetService.getActiveBudget();
    if (!personalBudget) {
      return monthlyBudget;
    }

    // Start with monthly budget categories
    const syncedCategories = { ...monthlyBudget.categories };
    
    // Sync all categories from personal budget
    for (const [categoryName, personalConfig] of Object.entries(personalBudget.categories)) {
      if (syncedCategories[categoryName]) {
        // Category exists in both - sync properties from personal budget
        // Keep monthlyLimit from monthly budget (may have been adjusted)
        syncedCategories[categoryName] = {
          ...syncedCategories[categoryName],
          isActive: personalConfig.isActive,
          color: personalConfig.color,
          description: personalConfig.description,
          warningThreshold: personalConfig.warningThreshold,
        };
      } else if (addNewCategories) {
        // Category added to personal budget but not in monthly yet - add it (only if flag is true)
        syncedCategories[categoryName] = { ...personalConfig };
      }
    }
    
    // Deactivate categories that were deleted from personal budget
    for (const categoryName of Object.keys(syncedCategories)) {
      if (!personalBudget.categories[categoryName]) {
        syncedCategories[categoryName] = {
          ...syncedCategories[categoryName],
          isActive: false
        };
      }
    }

    return {
      ...monthlyBudget,
      categories: syncedCategories,
      global_settings: personalBudget.global_settings // Sync global settings
    };
  }

  /**
   * Get monthly budget for a specific month
   * Returns null if doesn't exist
   * Syncs with personal budget for category metadata
   */
  static async getMonthlyBudget(
    year: number,
    month: number
  ): Promise<MonthlyBudget | null> {
    try {
      const householdId = await getHouseholdId();

      const { data, error } = await supabase
        .from('monthly_budgets')
        .select('*')
        .eq('household_id', householdId)
        .eq('year', year)
        .eq('month', month)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      // If no data returned, budget doesn't exist
      if (!data) {
        return null;
      }

      // Sync with personal budget (don't add new categories to existing monthly budgets)
      return await this.syncWithPersonalBudget(data, false);
    } catch (error) {
      console.error('Error fetching monthly budget:', error);
      throw error;
    }
  }

  /**
   * Get current month's budget
   * Syncs with personal budget to ensure all categories and isActive status are current
   */
  static async getCurrentMonthBudget(): Promise<MonthlyBudget> {
    const now = new Date();
    const monthlyBudget = await this.getOrCreateMonthlyBudget(
      now.getFullYear(),
      now.getMonth() + 1
    );

    // Sync with personal budget (don't add new categories mid-month)
    return await this.syncWithPersonalBudget(monthlyBudget, false);
  }

  /**
   * Get monthly budgets for a specific year
   */
  static async getYearBudgets(year: number): Promise<MonthlyBudget[]> {
    try {
      const householdId = await getHouseholdId();

      const { data, error } = await supabase
        .from('monthly_budgets')
        .select('*')
        .eq('household_id', householdId)
        .eq('year', year)
        .order('month', { ascending: true });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching year budgets:', error);
      throw error;
    }
  }

  /**
   * Delete a monthly budget for a specific month
   * Used when applying scheduled adjustments to force recreation with new limits
   */
  static async deleteMonthlyBudget(year: number, month: number): Promise<void> {
    try {
      const householdId = await getHouseholdId();

      const { error } = await supabase
        .from('monthly_budgets')
        .delete()
        .eq('household_id', householdId)
        .eq('year', year)
        .eq('month', month);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting monthly budget:', error);
      // Don't throw - this is a cleanup operation, main flow should continue
    }
  }

  /**
   * Get all monthly budgets ordered by date descending
   */
  static async getAllMonthlyBudgets(limit: number = 12): Promise<MonthlyBudget[]> {
    try {
      const householdId = await getHouseholdId();

      const { data, error } = await supabase
        .from('monthly_budgets')
        .select('*')
        .eq('household_id', householdId)
        .order('year', { ascending: false })
        .order('month', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching all monthly budgets:', error);
      throw error;
    }
  }

  /**
   * Get monthly budgets for a date range
   * Auto-creates missing monthly budgets from personal budget if they don't exist
   */
  static async getMonthlyBudgetsForDateRange(
    startDate: Date,
    endDate: Date
  ): Promise<MonthlyBudget[]> {
    try {
      const householdId = await getHouseholdId();      // Get all months in the range
      const monthsInRange: { year: number; month: number }[] = [];
      const current = new Date(startDate);
      while (current <= endDate) {
        monthsInRange.push({
          year: current.getFullYear(),
          month: current.getMonth() + 1, // 1-12
        });
        current.setMonth(current.getMonth() + 1);
      }

      // Fetch existing monthly budgets
      // Note: We need to fetch all budgets that fall within the year/month range
      const startYear = startDate.getFullYear();
      const startMonthNum = startDate.getMonth() + 1;
      const endYear = endDate.getFullYear();
      const endMonthNum = endDate.getMonth() + 1;

      // Build query based on whether it spans multiple years
      let query = supabase
        .from('monthly_budgets')
        .select('*')
        .eq('household_id', householdId);

      if (startYear === endYear) {
        // Same year, simple range
        query = query
          .eq('year', startYear)
          .gte('month', startMonthNum)
          .lte('month', endMonthNum);
      } else {
        // Multiple years - need OR condition
        // For now, fetch all budgets in year range and filter in memory
        query = query
          .gte('year', startYear)
          .lte('year', endYear);
      }

      const { data, error } = await query.order('year', { ascending: true }).order('month', { ascending: true });

      if (error) throw error;

      // Filter to exact range if spanning multiple years
      let existingBudgets = data || [];
      if (startYear !== endYear) {
        existingBudgets = existingBudgets.filter(b => {
          if (b.year < startYear || b.year > endYear) return false;
          if (b.year === startYear && b.month < startMonthNum) return false;
          if (b.year === endYear && b.month > endMonthNum) return false;
          return true;
        });
      }

      const existingMonths = new Set(existingBudgets.map(b => `${b.year}-${b.month}`));

      // Create missing monthly budgets
      const missingMonths = monthsInRange.filter(m => {
        const monthStr = `${m.year}-${m.month}`;
        return !existingMonths.has(monthStr);
      });

      // Create missing budgets if any
      if (missingMonths.length > 0) {
        await Promise.all(
          missingMonths.map(m => 
            this.getOrCreateMonthlyBudget(m.year, m.month)
          )
        );

        // Re-fetch all budgets after creation
        let refreshQuery = supabase
          .from('monthly_budgets')
          .select('*')
          .eq('household_id', householdId);

        if (startYear === endYear) {
          refreshQuery = refreshQuery
            .eq('year', startYear)
            .gte('month', startMonthNum)
            .lte('month', endMonthNum);
        } else {
          refreshQuery = refreshQuery
            .gte('year', startYear)
            .lte('year', endYear);
        }

        const { data: refreshedData, error: refreshError } = await refreshQuery
          .order('year', { ascending: true })
          .order('month', { ascending: true });

        if (refreshError) throw refreshError;

        // Filter to exact range if spanning multiple years
        let finalBudgets = refreshedData || [];
        if (startYear !== endYear) {
          finalBudgets = finalBudgets.filter(b => {
            if (b.year < startYear || b.year > endYear) return false;
            if (b.year === startYear && b.month < startMonthNum) return false;
            if (b.year === endYear && b.month > endMonthNum) return false;
            return true;
          });
        }
        
        return finalBudgets;
      }

      return existingBudgets;
    } catch (error) {
      console.error('Error fetching monthly budgets for date range:', error);
      throw error;
    }
  }

  /**
   * Create monthly budget from active personal budget
   */
  static async createMonthlyBudget(
    year: number,
    month: number,
    notes?: string
  ): Promise<MonthlyBudget> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const householdId = await getHouseholdId();

      // Get active personal budget
      const personalBudget = await PersonalBudgetService.getActiveBudget();
      
      if (!personalBudget) {
        throw new Error('No active personal budget found. Please create one first.');
      }

      const newMonthlyBudget: Omit<MonthlyBudget, 'id' | 'created_at' | 'updated_at'> = {
        user_id: user.id,
        household_id: householdId,
        personal_budget_id: personalBudget.id,
        year,
        month,
        categories: personalBudget.categories, // Current state (starts as copy of personal)
        original_categories: personalBudget.categories, // Month-start snapshot (never modified)
        global_settings: personalBudget.global_settings,
        adjustment_count: 0,
        is_locked: false,
        notes
      };

      const { data, error } = await supabase
        .from('monthly_budgets')
        .insert([newMonthlyBudget])
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error creating monthly budget:', error);
      throw error;
    }
  }

  /**
   * Update a specific category in monthly budget
   * Increments adjustment_count
   */
  static async updateCategoryLimit(
    monthlyBudgetId: string,
    categoryName: string,
    newLimit: number,
    notes?: string
    ): Promise<MonthlyBudget> {
    try {
      const householdId = await getHouseholdId();

      // Get current monthly budget
      const { data: currentBudget, error: fetchError } = await supabase
        .from('monthly_budgets')
        .select('*')
        .eq('id', monthlyBudgetId)
        .eq('household_id', householdId)
        .single();      if (fetchError) throw fetchError;
      if (!currentBudget) throw new Error('Monthly budget not found');

      if (currentBudget.is_locked) {
        throw new Error('Cannot modify locked monthly budget');
      }

      // Validate category exists
      if (!currentBudget.categories[categoryName]) {
        throw new Error(`Category "${categoryName}" not found`);
      }

      // Update the category limit
      const updatedCategories = {
        ...currentBudget.categories,
        [categoryName]: {
          ...currentBudget.categories[categoryName],
          monthlyLimit: newLimit
        }
      };

      const { data, error } = await supabase
        .from('monthly_budgets')
        .update({
          categories: updatedCategories,
          adjustment_count: currentBudget.adjustment_count + 1,
          notes: notes || currentBudget.notes
        })
        .eq('id', monthlyBudgetId)
        .eq('household_id', householdId)
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error updating category limit:', error);
      throw error;
    }
  }

  /**
   * Rename a category in all monthly budgets
   * Updates the key in the categories JSON object
   */
  static async renameCategoryInAllBudgets(
    oldName: string,
    newName: string
  ): Promise<void> {
    try {
      const householdId = await getHouseholdId();

      // Get all monthly budgets that contain this category
      const { data: budgets, error: fetchError } = await supabase
        .from('monthly_budgets')
        .select('*')
        .eq('household_id', householdId);

      if (fetchError) throw fetchError;
      if (!budgets || budgets.length === 0) return;

      // Update each budget that has the old category name
      for (const budget of budgets) {
        if (budget.categories && budget.categories[oldName]) {
          const updatedCategories = { ...budget.categories };
          // Copy the category data to the new key
          updatedCategories[newName] = updatedCategories[oldName];
          // Delete the old key
          delete updatedCategories[oldName];

          // Also update original_categories if it exists
          let updatedOriginalCategories = budget.original_categories;
          if (updatedOriginalCategories && updatedOriginalCategories[oldName]) {
            updatedOriginalCategories = { ...updatedOriginalCategories };
            updatedOriginalCategories[newName] = updatedOriginalCategories[oldName];
            delete updatedOriginalCategories[oldName];
          }

          const { error: updateError } = await supabase
            .from('monthly_budgets')
            .update({
              categories: updatedCategories,
              original_categories: updatedOriginalCategories
            })
            .eq('id', budget.id);

          if (updateError) {
            console.error(`Error updating budget ${budget.id}:`, updateError);
          }
        }
      }
    } catch (error) {
      console.error('Error renaming category in budgets:', error);
      throw error;
    }
  }

  /**
   * Remove a category from all monthly budgets
   * Used when a category is deleted
   */
  static async removeCategoryFromAllBudgets(
    categoryName: string
  ): Promise<void> {
    try {
      const householdId = await getHouseholdId();

      // Get all monthly budgets that contain this category
      const { data: budgets, error: fetchError } = await supabase
        .from('monthly_budgets')
        .select('*')
        .eq('household_id', householdId);

      if (fetchError) throw fetchError;
      if (!budgets || budgets.length === 0) return;

      // Update each budget that has this category
      for (const budget of budgets) {
        if (budget.categories && budget.categories[categoryName]) {
          const updatedCategories = { ...budget.categories };
          delete updatedCategories[categoryName];

          // Also update original_categories if it exists
          let updatedOriginalCategories = budget.original_categories;
          if (updatedOriginalCategories && updatedOriginalCategories[categoryName]) {
            updatedOriginalCategories = { ...updatedOriginalCategories };
            delete updatedOriginalCategories[categoryName];
          }

          const { error: updateError } = await supabase
            .from('monthly_budgets')
            .update({
              categories: updatedCategories,
              original_categories: updatedOriginalCategories
            })
            .eq('id', budget.id);

          if (updateError) {
            console.error(`Error updating budget ${budget.id}:`, updateError);
          }
        }
      }
    } catch (error) {
      console.error('Error removing category from budgets:', error);
      throw error;
    }
  }

  /**
   * Lock a monthly budget (prevent further modifications)
   * Typically done for past months
   */
  static async lockMonthlyBudget(
    year: number,
    month: number
  ): Promise<MonthlyBudget> {
    try {
      const householdId = await getHouseholdId();

      const { data, error } = await supabase
        .from('monthly_budgets')
        .update({ is_locked: true })
        .eq('household_id', householdId)
        .eq('year', year)
        .eq('month', month)
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error locking monthly budget:', error);
      throw error;
    }
  }

  /**
   * Unlock a monthly budget
   */
  static async unlockMonthlyBudget(
    year: number,
    month: number
  ): Promise<MonthlyBudget> {
    try {
      const householdId = await getHouseholdId();

      const { data, error } = await supabase
        .from('monthly_budgets')
        .update({ is_locked: false })
        .eq('household_id', householdId)
        .eq('year', year)
        .eq('month', month)
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error unlocking monthly budget:', error);
      throw error;
    }
  }

  /**
   * Compare monthly budget to personal budget
   * Returns detailed comparison for each category
   */
  static async compareToPersonalBudget(
    year: number,
    month: number
  ): Promise<BudgetComparisonSummary> {
    try {
      const monthlyBudget = await this.getMonthlyBudget(year, month);
      
      if (!monthlyBudget) {
        throw new Error('Monthly budget not found');
      }

      let personalBudget: PersonalBudget | null = null;
      
      if (monthlyBudget.personal_budget_id) {
        personalBudget = await PersonalBudgetService.getBudgetById(
          monthlyBudget.personal_budget_id
        );
      }

      if (!personalBudget) {
        personalBudget = await PersonalBudgetService.getActiveBudget();
      }

      if (!personalBudget) {
        throw new Error('No personal budget found for comparison');
      }

      const comparisons: BudgetComparisonResult[] = [];
      let totalPersonal = 0;
      let totalMonthly = 0;
      let adjustedCount = 0;
      let addedCount = 0;
      let removedCount = 0;
      let activeCount = 0;

      // Calculate total personal budget (all active categories in personal budget)
      for (const [, categoryConfig] of Object.entries(personalBudget.categories)) {
        if (categoryConfig.isActive) {
          totalPersonal += categoryConfig.monthlyLimit;
        }
      }

      // Get all categories from both budgets
      const allCategories = new Set([
        ...Object.keys(monthlyBudget.categories),
        ...Object.keys(personalBudget.categories)
      ]);

      // Compare each category
      for (const categoryName of allCategories) {
        const monthlyConfig = monthlyBudget.categories[categoryName];
        const personalConfig = personalBudget.categories[categoryName];
        
        // Determine category status
        let status: 'increased' | 'decreased' | 'unchanged' | 'added' | 'removed';
        let personalLimit: number | null = personalConfig?.monthlyLimit ?? null;
        let monthlyLimit: number = monthlyConfig?.monthlyLimit ?? 0;
        let isActive = monthlyConfig?.isActive ?? false;
        let difference: number;
        let differencePercentage: number;
        
        if (!personalConfig && monthlyConfig) {
          // Category added in monthly budget
          status = 'added';
          addedCount++;
          if (isActive) {
            activeCount++;
            totalMonthly += monthlyLimit;
          }
          difference = monthlyLimit; // Full amount is the difference
          differencePercentage = 0;
        } else if (personalConfig && !monthlyConfig?.isActive) {
          // Category exists in personal but deactivated in monthly budget
          status = 'removed';
          removedCount++;
          isActive = false;
          // Show as removed from monthly budget
          personalLimit = personalConfig.monthlyLimit;
          monthlyLimit = 0; // It's deactivated, so monthly limit is effectively 0
          difference = -personalLimit; // Negative to show reduction
          differencePercentage = -100; // 100% reduction
        } else if (personalConfig && monthlyConfig && monthlyConfig.isActive) {
          // Category exists in both and is active in monthly
          isActive = true;
          activeCount++;
          difference = monthlyLimit - personalLimit!;
          differencePercentage = personalLimit! > 0 ? (difference / personalLimit!) * 100 : 0;
          
          if (difference > 0) {
            status = 'increased';
            adjustedCount++;
          } else if (difference < 0) {
            status = 'decreased';
            adjustedCount++;
          } else {
            status = 'unchanged';
          }
          
          // Don't add to totalPersonal here - already calculated above
          totalMonthly += monthlyLimit;
        } else {
          continue; // Skip inactive or undefined categories
        }

        comparisons.push({
          category: categoryName,
          personalLimit,
          monthlyLimit,
          difference,
          differencePercentage,
          status,
          isActive
        });
      }

      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                         'July', 'August', 'September', 'October', 'November', 'December'];

      return {
        personalBudgetName: personalBudget.name,
        monthlyBudgetDate: `${monthNames[month - 1]} ${year}`,
        currency: personalBudget.global_settings.currency,
        totalCategories: allCategories.size,
        activeCategories: activeCount,
        adjustedCategories: adjustedCount,
        addedCategories: addedCount,
        removedCategories: removedCount,
        comparisons,
        totalPersonalLimit: totalPersonal,
        totalMonthlyLimit: totalMonthly,
        totalDifference: totalMonthly - totalPersonal
      };
    } catch (error) {
      console.error('Error comparing to personal budget:', error);
      throw error;
    }
  }

  /**
   * Get total monthly limit across all active categories
   */
  static getTotalMonthlyLimit(budget: MonthlyBudget): number {
    return Object.values(budget.categories)
      .filter(cat => cat.isActive)
      .reduce((sum, cat) => sum + cat.monthlyLimit, 0);
  }

  /**
   * Compare current monthly budget to its ORIGINAL state
   * Shows in-month changes (adjustments made after month started)
   * This is different from compareToPersonalBudget which shows deviation from baseline
   */
  static async compareToOriginal(
    year: number,
    month: number
  ): Promise<BudgetComparisonSummary> {
    try {
      const monthlyBudget = await this.getMonthlyBudget(year, month);
      if (!monthlyBudget) {
        throw new Error('Monthly budget not found');
      }

      const comparisons: BudgetComparisonResult[] = [];
      let totalOriginal = 0;
      let totalCurrent = 0;
      let adjustedCount = 0;
      let addedCount = 0;
      let removedCount = 0;
      let activeCount = 0;

      // Calculate total from original categories (month-start baseline)
      for (const [, categoryConfig] of Object.entries(monthlyBudget.original_categories)) {
        if (categoryConfig.isActive) {
          totalOriginal += categoryConfig.monthlyLimit;
        }
      }

      // Get all categories from both original and current
      const allCategories = new Set([
        ...Object.keys(monthlyBudget.categories),
        ...Object.keys(monthlyBudget.original_categories)
      ]);

      // Compare each category
      for (const categoryName of allCategories) {
        const currentConfig = monthlyBudget.categories[categoryName];
        const originalConfig = monthlyBudget.original_categories[categoryName];

        let status: 'increased' | 'decreased' | 'unchanged' | 'added' | 'removed';
        let originalLimit: number | null = originalConfig?.monthlyLimit ?? null;
        let currentLimit: number = currentConfig?.monthlyLimit ?? 0;
        let isActive = currentConfig?.isActive ?? false;
        let difference: number;
        let differencePercentage: number;

        if (!originalConfig && currentConfig) {
          // Category added during the month
          status = 'added';
          addedCount++;
          if (isActive) {
            activeCount++;
            totalCurrent += currentLimit;
          }
          difference = currentLimit;
          differencePercentage = 0;
        } else if (originalConfig && !currentConfig?.isActive) {
          // Category was active at month start but deactivated during month
          status = 'removed';
          removedCount++;
          isActive = false;
          originalLimit = originalConfig.monthlyLimit;
          currentLimit = 0;
          difference = -originalLimit;
          differencePercentage = -100;
        } else if (originalConfig && currentConfig && currentConfig.isActive) {
          // Category exists in both and is currently active
          isActive = true;
          activeCount++;
          difference = currentLimit - originalLimit!;
          differencePercentage = originalLimit! > 0 ? (difference / originalLimit!) * 100 : 0;

          if (difference > 0) {
            status = 'increased';
            adjustedCount++;
          } else if (difference < 0) {
            status = 'decreased';
            adjustedCount++;
          } else {
            status = 'unchanged';
          }

          totalCurrent += currentLimit;
        } else {
          // Category exists but is inactive (shouldn't normally happen, but handle it)
          continue;
        }

        comparisons.push({
          category: categoryName,
          personalLimit: originalLimit, // Using original as the baseline
          monthlyLimit: currentLimit,
          difference,
          differencePercentage,
          status,
          isActive
        });
      }

      return {
        monthlyBudgetDate: `${this.getMonthName(month)} ${year}`,
        personalBudgetName: 'Month Start Budget', // Original state at month creation
        totalPersonalLimit: totalOriginal, // Month-start total
        totalMonthlyLimit: totalCurrent, // Current total
        totalDifference: totalCurrent - totalOriginal,
        totalCategories: allCategories.size,
        activeCategories: activeCount,
        adjustedCategories: adjustedCount,
        addedCategories: addedCount,
        removedCategories: removedCount,
        currency: monthlyBudget.global_settings.currency,
        comparisons: comparisons.sort((a, b) => {
          // Sort by status priority: added > adjusted > removed > unchanged
          const statusOrder = { added: 0, increased: 1, decreased: 2, removed: 3, unchanged: 4 };
          return statusOrder[a.status] - statusOrder[b.status];
        })
      };
    } catch (error) {
      console.error('Error comparing to original budget:', error);
      throw error;
    }
  }

  /**
   * Check if monthly budget has been adjusted from personal
   */
  static hasAdjustments(budget: MonthlyBudget): boolean {
    return budget.adjustment_count > 0;
  }

  /**
   * Get month name from number
   */
  static getMonthName(month: number): string {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];
    return monthNames[month - 1] || 'Unknown';
  }

  /**
   * Format month/year for display
   */
  static formatMonthYear(year: number, month: number): string {
    return `${this.getMonthName(month)} ${year}`;
  }
}

// Export singleton instance
export const monthlyBudgetService = MonthlyBudgetService;
