// React Query hook for categories
// Part of Category Management Restructure (Phase 4)

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as categoryService from '../services/categoryService';
import { MonthlyBudgetService } from '../services/monthlyBudgetService';
import { PersonalBudgetService } from '../services/personalBudgetService';
import type { 
  CategoryCreateInput, 
  CategoryUpdateInput,
  CategoryMergeResult 
} from '../types/category';

// Query keys
export const categoryKeys = {
  all: ['categories'] as const,
  list: () => [...categoryKeys.all, 'list'] as const,
  detail: (id: string) => [...categoryKeys.all, 'detail', id] as const,
  mergeHistory: () => [...categoryKeys.all, 'mergeHistory'] as const,
};

/**
 * Hook to fetch all active categories
 * @param includeDeleted - Include soft-deleted categories
 * @param type - Filter by category type ('expense' or 'income')
 */
export function useCategories(includeDeleted = false, type?: 'expense' | 'income') {
  return useQuery({
    queryKey: [...categoryKeys.list(), { includeDeleted, type }],
    queryFn: () => categoryService.getCategories(includeDeleted, type),
  });
}

/**
 * Hook to fetch a single category by ID
 */
export function useCategory(categoryId: string | null) {
  return useQuery({
    queryKey: categoryKeys.detail(categoryId || ''),
    queryFn: () => categoryService.getCategoryById(categoryId!),
    enabled: !!categoryId,
  });
}

/**
 * Hook to fetch merge history
 */
export function useMergeHistory() {
  return useQuery({
    queryKey: categoryKeys.mergeHistory(),
    queryFn: () => categoryService.getMergeHistory(),
  });
}

/**
 * Hook to create a new category
 */
export function useCreateCategory() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: CategoryCreateInput) => {
      const created = await categoryService.createCategory(input);
      // The transaction forms read categories from the active budget, not the categories table
      // The category already exists at this point, so a failed sync must not report the create
      // as failed: a retry would only hit the duplicate-name check
      if (created.type === 'expense' && created.isActive) {
        try {
          await PersonalBudgetService.addCategoryToActiveBudget(created.name, {
            monthlyLimit: created.monthlyLimit,
            warningThreshold: created.warningThreshold,
            isActive: true,
            color: created.color,
          });
        } catch (error) {
          console.error('Category created but not added to the active budget:', error);
        }
      }
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.list() });
      queryClient.invalidateQueries({ queryKey: ['personalBudget'] });
    },
  });
}

/**
 * Hook to update a category
 * Syncs color/warningThreshold to personal budgets JSONB (these are permanent properties)
 * NOTE: monthlyLimit is NOT synced here - it's handled separately for monthly budget edits
 */
export function useUpdateCategory() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ categoryId, input, categoryName }: { categoryId: string; input: CategoryUpdateInput; categoryName?: string }) => {
      // 1. Update in categories table
      const updatedCategory = await categoryService.updateCategory(categoryId, input);
      
      // 2. Sync to personal budgets JSONB (only color and warningThreshold, NOT monthlyLimit)
      // monthlyLimit changes are permanent for each monthly budget - handled by updateCategoryLimit
      const nameToUpdate = categoryName || updatedCategory.name;
      const budgetUpdates: { color?: string; warningThreshold?: number } = {};
      
      if (input.color !== undefined) budgetUpdates.color = input.color;
      if (input.warningThreshold !== undefined) budgetUpdates.warningThreshold = input.warningThreshold;
      // NOTE: We intentionally do NOT sync monthlyLimit to personal budgets
      // Mid-month limit changes should only affect monthly_budgets.categories (current)
      
      if (Object.keys(budgetUpdates).length > 0) {
        await PersonalBudgetService.updateCategoryInAllBudgets(nameToUpdate, budgetUpdates);
      }
      
      return updatedCategory;
    },
    onSuccess: (updatedCategory) => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.list() });
      queryClient.invalidateQueries({ queryKey: ['personalBudget'] });
      queryClient.setQueryData(categoryKeys.detail(updatedCategory.id), updatedCategory);
    },
  });
}

/**
 * Hook to rename a category
 * Also updates the category name in all budgets and transactions
 */
export function useRenameCategory() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ categoryId, newName, oldName }: { categoryId: string; newName: string; oldName: string }) => {
      // 1. Rename in categories table
      const updatedCategory = await categoryService.renameCategory(categoryId, newName);
      
      // 2. Rename in all monthly budgets (categories JSONB)
      await MonthlyBudgetService.renameCategoryInAllBudgets(oldName, newName);
      
      // 3. Rename in all personal budgets (categories JSONB)
      await PersonalBudgetService.renameCategoryInAllBudgets(oldName, newName);
      
      // 4. Rename in all transactions (category string column)
      await PersonalBudgetService.renameCategoryInTransactions(oldName, newName);
      
      return updatedCategory;
    },
    onSuccess: (updatedCategory) => {
      // Invalidate all related queries to refresh UI
      queryClient.invalidateQueries({ queryKey: categoryKeys.list() });
      queryClient.invalidateQueries({ queryKey: ['monthlyBudget'] });
      queryClient.invalidateQueries({ queryKey: ['personalBudget'] }); // This covers 'active' and 'history'
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.setQueryData(categoryKeys.detail(updatedCategory.id), updatedCategory);
    },
  });
}

/**
 * Hook to delete a category
 * Also removes the category from all monthly budgets
 */
export function useDeleteCategory() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ categoryId, categoryName }: { categoryId: string; categoryName: string }) => {
      // First delete from categories table (soft delete)
      await categoryService.deleteCategory(categoryId);
      // Then remove from all monthly budgets
      await MonthlyBudgetService.removeCategoryFromAllBudgets(categoryName);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.list() });
      queryClient.invalidateQueries({ queryKey: ['monthlyBudget'] });
      queryClient.invalidateQueries({ queryKey: ['activeBudget'] });
    },
  });
}

/**
 * Hook to restore a deleted category
 */
export function useRestoreCategory() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (categoryId: string) => categoryService.restoreCategory(categoryId),
    onSuccess: (restoredCategory) => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.list() });
      queryClient.setQueryData(categoryKeys.detail(restoredCategory.id), restoredCategory);
    },
  });
}

/**
 * Hook to merge categories
 */
export function useMergeCategories() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ 
      sourceCategoryId, 
      targetCategoryId, 
      reason 
    }: { 
      sourceCategoryId: string; 
      targetCategoryId: string; 
      reason?: string;
    }): Promise<CategoryMergeResult> => 
      categoryService.mergeCategories(sourceCategoryId, targetCategoryId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.list() });
      queryClient.invalidateQueries({ queryKey: categoryKeys.mergeHistory() });
      // Also invalidate transactions since category_ids changed
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

/**
 * Hook to undo a category merge
 */
export function useUndoCategoryMerge() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (mergeId: string) => categoryService.undoCategoryMerge(mergeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.list() });
      queryClient.invalidateQueries({ queryKey: categoryKeys.mergeHistory() });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

/**
 * Hook to update category sort order
 */
export function useUpdateCategorySortOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (categoryIds: string[]) => categoryService.updateCategorySortOrder(categoryIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.list() });
    },
  });
}

/**
 * Utility: Count transactions for a category
 * This is used to show "X transactions" in the UI
 */
export function useCategoryTransactionCount(categoryId: string | null) {
  return useQuery({
    queryKey: ['transactions', 'count', categoryId],
    queryFn: async () => {
      if (!categoryId) return 0;
      const { supabase } = await import('../lib/supabase');
      const { count, error } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('category_id', categoryId);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!categoryId,
  });
}
