import { supabase } from '../lib/supabase';
import { PersonalBudgetService } from './personalBudgetService';
import { MonthlyBudgetService } from './monthlyBudgetService';
import type {
  BudgetAdjustment,
  CategoryAdjustmentHistory,
  PendingAdjustmentsSummary,
  PersonalBudget,
  CategoryConfig
} from '../types/budget';

/**
 * Helper to get user's household_id
 */
const getHouseholdId = async (): Promise<string> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .single();

  if (error) throw error;
  if (!data) throw new Error('User not part of any household');

  return data.household_id;
};

/**
 * Budget Adjustment Service
 * Manages scheduled budget adjustments and category history tracking
 */
export class BudgetAdjustmentService {
  /**
   * Schedule an adjustment for next month
   * When applied, this will update the Personal Budget
   */
  static async scheduleAdjustment(
    categoryName: string,
    currentLimit: number,
    newLimit: number,
    reason?: string
  ): Promise<BudgetAdjustment> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const householdId = await getHouseholdId();

      // Calculate next month
      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const effectiveYear = nextMonth.getFullYear();
      const effectiveMonth = nextMonth.getMonth() + 1;

      const adjustmentAmount = Math.abs(newLimit - currentLimit);
      const adjustmentType: 'increase' | 'decrease' = newLimit > currentLimit ? 'increase' : 'decrease';

      const adjustment: Omit<BudgetAdjustment, 'id' | 'created_at' | 'applied_at'> = {
        user_id: user.id,
        household_id: householdId,
        category_name: categoryName,
        current_limit: currentLimit,
        adjustment_type: adjustmentType,
        adjustment_amount: adjustmentAmount,
        new_limit: newLimit,
        effective_year: effectiveYear,
        effective_month: effectiveMonth,
        reason,
        is_applied: false,
        created_by_user_id: user.id
      };

      const { data, error } = await supabase
        .from('budget_adjustments')
        .insert([adjustment])
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error scheduling adjustment:', error);
      throw error;
    }
  }

  /**
   * Get all pending adjustments for a specific month
   */
  static async getPendingAdjustments(
    year: number,
    month: number
  ): Promise<BudgetAdjustment[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('budget_adjustments')
        .select('*')
        .eq('user_id', user.id)
        .eq('effective_year', year)
        .eq('effective_month', month)
        .eq('is_applied', false)
        .order('category_name', { ascending: true });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching pending adjustments:', error);
      throw error;
    }
  }

  /**
   * Get all pending adjustments effective on or before a month (read-only).
   * Used to build a projected budget for a future month.
   */
  static async getPendingAdjustmentsThrough(
    year: number,
    month: number
  ): Promise<BudgetAdjustment[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('budget_adjustments')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_applied', false)
        .or(`effective_year.lt.${year},and(effective_year.eq.${year},effective_month.lte.${month})`)
        .order('effective_year', { ascending: true })
        .order('effective_month', { ascending: true });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching pending adjustments:', error);
      throw error;
    }
  }

  /**
   * Get pending adjustments for next month
   */
  static async getNextMonthAdjustments(): Promise<PendingAdjustmentsSummary> {
    try {
      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const year = nextMonth.getFullYear();
      const month = nextMonth.getMonth() + 1;

      const adjustments = await this.getPendingAdjustments(year, month);

      const totalIncrease = adjustments
        .filter(a => a.adjustment_type === 'increase')
        .reduce((sum, a) => sum + a.adjustment_amount, 0);

      const totalDecrease = adjustments
        .filter(a => a.adjustment_type === 'decrease')
        .reduce((sum, a) => sum + a.adjustment_amount, 0);

      return {
        effectiveDate: MonthlyBudgetService.formatMonthYear(year, month),
        adjustmentCount: adjustments.length,
        totalIncrease,
        totalDecrease,
        netChange: totalIncrease - totalDecrease,
        adjustments
      };
    } catch (error) {
      console.error('Error getting next month adjustments:', error);
      throw error;
    }
  }

  /**
   * Get all pending adjustments across all months
   */
  static async getAllPendingAdjustments(): Promise<BudgetAdjustment[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('budget_adjustments')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_applied', false)
        .order('effective_year', { ascending: true })
        .order('effective_month', { ascending: true })
        .order('category_name', { ascending: true });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching all pending adjustments:', error);
      throw error;
    }
  }

  /**
   * Cancel a scheduled adjustment
   */
  static async cancelAdjustment(adjustmentId: string): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { error } = await supabase
        .from('budget_adjustments')
        .delete()
        .eq('id', adjustmentId)
        .eq('user_id', user.id)
        .eq('is_applied', false); // Can only cancel pending adjustments

      if (error) throw error;
    } catch (error) {
      console.error('Error canceling adjustment:', error);
      throw error;
    }
  }

  /**
   * Cancel all pending adjustments for a specific month
   */
  static async cancelAllAdjustments(year: number, month: number): Promise<number> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const adjustments = await this.getPendingAdjustments(year, month);
      
      for (const adjustment of adjustments) {
        await this.cancelAdjustment(adjustment.id);
      }

      return adjustments.length;
    } catch (error) {
      console.error('Error canceling all adjustments:', error);
      throw error;
    }
  }

  /**
   * Apply scheduled adjustments for a specific month
   * This updates the Personal Budget and creates the monthly budget
   * Typically called on the 1st of the month (background job)
   */
  static async applyScheduledAdjustments(
    year: number,
    month: number
  ): Promise<{ appliedCount: number; personalBudget: PersonalBudget | null }> {
    try {
      const adjustments = await this.getPendingAdjustments(year, month);

      if (adjustments.length === 0) {
        return { appliedCount: 0, personalBudget: null };
      }

      // Get current active personal budget
      const currentPersonalBudget = await PersonalBudgetService.getActiveBudget();
      
      if (!currentPersonalBudget) {
        throw new Error('No active personal budget found');
      }

      // Apply all adjustments to create updated categories
      const updatedCategories: Record<string, CategoryConfig> = {
        ...currentPersonalBudget.categories
      };

      for (const adjustment of adjustments) {
        // Check if this is a new category (metadata encoded in reason)
        const isNewCategory = adjustment.current_limit === 0 && !updatedCategories[adjustment.category_name];
        let categoryMetadata = null;
        
        if (isNewCategory && adjustment.reason) {
          // Extract metadata from reason field
          const metaMatch = adjustment.reason.match(/__META__:(.+)$/);
          if (metaMatch) {
            try {
              categoryMetadata = JSON.parse(metaMatch[1]);
            } catch (e) {
              // If parsing fails, use defaults
              categoryMetadata = null;
            }
          }
        }

        if (updatedCategories[adjustment.category_name]) {
          // Existing category - update monthly limit
          updatedCategories[adjustment.category_name] = {
            ...updatedCategories[adjustment.category_name],
            monthlyLimit: adjustment.new_limit
          };
        } else if (isNewCategory) {
          // New category - create it with metadata
          updatedCategories[adjustment.category_name] = {
            monthlyLimit: adjustment.new_limit,
            warningThreshold: categoryMetadata?.warningThreshold || 80,
            isActive: categoryMetadata?.isActive !== false,
            color: categoryMetadata?.color || '#3B82F6',
            description: categoryMetadata?.description || '',
          };
        }

        // Update category adjustment history
        await this.updateCategoryHistory(
          adjustment.category_name,
          adjustment.adjustment_type,
          adjustment.adjustment_amount
        );

        // Mark adjustment as applied
        await this.markAdjustmentAsApplied(adjustment.id);
      }

      // Create new personal budget version with updated categories
      const newPersonalBudget = await PersonalBudgetService.updateBudget(
        currentPersonalBudget.id,
        {
          categories: updatedCategories,
          name: `${currentPersonalBudget.name} (Auto-adjusted ${MonthlyBudgetService.formatMonthYear(year, month)})`
        }
      );

      // Delete the monthly budget for this month so it gets recreated with new values
      // This ensures the monthly budget picks up the adjusted limits from personal budget
      await MonthlyBudgetService.deleteMonthlyBudget(year, month);

      return {
        appliedCount: adjustments.length,
        personalBudget: newPersonalBudget
      };
    } catch (error) {
      console.error('Error applying scheduled adjustments:', error);
      throw error;
    }
  }

  /**
   * Mark an adjustment as applied
   */
  private static async markAdjustmentAsApplied(adjustmentId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('budget_adjustments')
        .update({
          is_applied: true,
          applied_at: new Date().toISOString()
        })
        .eq('id', adjustmentId);

      if (error) throw error;
    } catch (error) {
      console.error('Error marking adjustment as applied:', error);
      throw error;
    }
  }

  /**
   * Update category adjustment history
   */
  private static async updateCategoryHistory(
    categoryName: string,
    adjustmentType: 'increase' | 'decrease',
    adjustmentAmount: number
  ): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const householdId = await getHouseholdId();

      // Try to get existing history
      const { data: existing } = await supabase
        .from('category_adjustment_history')
        .select('*')
        .eq('household_id', householdId)
        .eq('category_name', categoryName)
        .single();

      if (existing) {
        // Update existing history
        const { error } = await supabase
          .from('category_adjustment_history')
          .update({
            adjustment_count: existing.adjustment_count + 1,
            last_adjusted_at: new Date().toISOString(),
            total_increased_amount: existing.total_increased_amount + 
              (adjustmentType === 'increase' ? adjustmentAmount : 0),
            total_decreased_amount: existing.total_decreased_amount + 
              (adjustmentType === 'decrease' ? adjustmentAmount : 0)
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Create new history record - must include household_id for RLS
        const newHistory = {
          user_id: user.id,
          household_id: householdId,
          category_name: categoryName,
          adjustment_count: 1,
          last_adjusted_at: new Date().toISOString(),
          total_increased_amount: adjustmentType === 'increase' ? adjustmentAmount : 0,
          total_decreased_amount: adjustmentType === 'decrease' ? adjustmentAmount : 0,
          first_adjustment_at: new Date().toISOString()
        };

        const { error } = await supabase
          .from('category_adjustment_history')
          .insert([newHistory]);

        if (error) throw error;
      }
    } catch (error) {
      console.error('Error updating category history:', error);
      // Don't throw - history tracking is non-critical, let the main flow continue
      console.warn('Category history tracking failed, but adjustment will still be applied');
    }
  }

  /**
   * Get adjustment history for a specific category
   */
  static async getCategoryHistory(categoryName: string): Promise<CategoryAdjustmentHistory | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('category_adjustment_history')
        .select('*')
        .eq('user_id', user.id)
        .eq('category_name', categoryName)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error fetching category history:', error);
      throw error;
    }
  }

  /**
   * Get all category adjustment histories
   */
  static async getAllCategoryHistories(): Promise<CategoryAdjustmentHistory[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('category_adjustment_history')
        .select('*')
        .eq('user_id', user.id)
        .order('adjustment_count', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching all category histories:', error);
      throw error;
    }
  }

  /**
   * Get most frequently adjusted categories
   */
  static async getMostAdjustedCategories(limit: number = 5): Promise<CategoryAdjustmentHistory[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('category_adjustment_history')
        .select('*')
        .eq('user_id', user.id)
        .order('adjustment_count', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching most adjusted categories:', error);
      throw error;
    }
  }

  /**
   * Check if there are pending adjustments for next month
   */
  static async hasPendingNextMonthAdjustments(): Promise<boolean> {
    try {
      const summary = await this.getNextMonthAdjustments();
      return summary.adjustmentCount > 0;
    } catch (error) {
      console.error('Error checking pending adjustments:', error);
      return false;
    }
  }

  /**
   * Get adjustment history for a specific month
   * (adjustments that were applied for that month)
   */
  static async getAppliedAdjustments(year: number, month: number): Promise<BudgetAdjustment[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('budget_adjustments')
        .select('*')
        .eq('user_id', user.id)
        .eq('effective_year', year)
        .eq('effective_month', month)
        .eq('is_applied', true)
        .order('category_name', { ascending: true });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching applied adjustments:', error);
      throw error;
    }
  }

  /**
   * Calculate net adjustment for a category
   */
  static calculateNetAdjustment(history: CategoryAdjustmentHistory): number {
    return history.total_increased_amount - history.total_decreased_amount;
  }

  /**
   * Get average adjustment amount for a category
   */
  static getAverageAdjustment(history: CategoryAdjustmentHistory): number {
    if (history.adjustment_count === 0) return 0;
    const totalAdjustments = history.total_increased_amount + history.total_decreased_amount;
    return totalAdjustments / history.adjustment_count;
  }
}

// Export singleton instance
export const budgetAdjustmentService = BudgetAdjustmentService;
