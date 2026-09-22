import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { PersonalBudgetService } from '../services/personalBudgetService';
import { MonthlyBudgetService } from '../services/monthlyBudgetService';
import { BudgetAdjustmentService } from '../services/budgetAdjustmentService';
import type { PersonalBudget } from '../types/budget';

/**
 * Hook to get the active personal budget
 */
export function useActiveBudget() {
  return useQuery({
    queryKey: ['personalBudget', 'active'],
    queryFn: async () => {
      try {
        return await PersonalBudgetService.getActiveBudget();
      } catch (error: any) {
        // Handle "not part of household" error gracefully
        // This can happen for brand new users before migration 009 is applied
        if (error?.message?.includes('User is not part of a household')) {
          console.warn('User has no household yet - they may need to create one');
          return null;
        }
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error: any) => {
      // Don't retry if the user simply doesn't have a household
      if (error?.message?.includes('User is not part of a household')) {
        return false;
      }
      return failureCount < 3;
    },
  });
}

/**
 * Hook to get personal budget history
 */
export function usePersonalBudgetHistory() {
  return useQuery({
    queryKey: ['personalBudget', 'history'],
    queryFn: async () => {
      try {
        return await PersonalBudgetService.getBudgetHistory();
      } catch (error: any) {
        // Handle "not part of household" error gracefully
        if (error?.message?.includes('User is not part of a household')) {
          console.warn('User has no household yet');
          return [];
        }
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error: any) => {
      if (error?.message?.includes('User is not part of a household')) {
        return false;
      }
      return failureCount < 3;
    },
  });
}

/**
 * Hook to get a specific personal budget by ID
 */
export function usePersonalBudgetById(budgetId?: string) {
  return useQuery({
    queryKey: ['personalBudget', budgetId],
    queryFn: () => budgetId ? PersonalBudgetService.getBudgetById(budgetId) : null,
    enabled: !!budgetId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to create a new personal budget
 */
export function useCreatePersonalBudget() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (budget: Omit<PersonalBudget, 'id' | 'user_id' | 'version' | 'created_at' | 'updated_at' | 'is_active'>) =>
      PersonalBudgetService.createBudget(budget),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personalBudget'] });
      // Invalidate monthly budgets since new personal budget created
      queryClient.invalidateQueries({ queryKey: ['monthlyBudget'] });
      // Invalidate categories since they're synced from budget
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

/**
 * Hook to update a personal budget (creates new version)
 */
export function useUpdatePersonalBudget() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ budgetId, updates }: { 
      budgetId: string; 
      updates: Partial<PersonalBudget>;
    }) => PersonalBudgetService.updateBudget(budgetId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personalBudget'] });
      // Invalidate monthly budgets since categories might have changed
      queryClient.invalidateQueries({ queryKey: ['monthlyBudget'] });
      // Invalidate categories since they're synced from budget
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

/**
 * Hook to set a budget as active
 */
export function useSetActiveBudget() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (budgetId: string) => PersonalBudgetService.setActiveBudget(budgetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personalBudget'] });
      // Invalidate monthly budgets since active budget changed
      queryClient.invalidateQueries({ queryKey: ['monthlyBudget'] });
    },
  });
}

/**
 * Hook to delete a personal budget
 */
export function useDeletePersonalBudget() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (budgetId: string) => PersonalBudgetService.deleteBudget(budgetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personalBudget'] });
      // Invalidate monthly budgets since personal budget deleted
      queryClient.invalidateQueries({ queryKey: ['monthlyBudget'] });
    },
  });
}

/**
 * Hook to reset ALL budgets - bringing user back to default state
 */
export function useResetAllBudgets() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (options?: { includeMonthlyBudgets?: boolean; includeTransactions?: boolean }) => 
      PersonalBudgetService.resetAllBudgets(options),
    onSuccess: () => {
      // Invalidate all budget-related queries
      queryClient.invalidateQueries({ queryKey: ['personalBudget'] });
      queryClient.invalidateQueries({ queryKey: ['monthlyBudget'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

/**
 * Hook to get current month's budget
 */
export function useCurrentMonthBudget() {
  return useQuery({
    queryKey: ['monthlyBudget', 'current'],
    queryFn: () => MonthlyBudgetService.getCurrentMonthBudget(),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook to get a specific monthly budget
 */
export function useMonthlyBudget(year?: number, month?: number) {
  return useQuery({
    queryKey: ['monthlyBudget', year, month],
    queryFn: () => year && month ? MonthlyBudgetService.getOrCreateMonthlyBudget(year, month) : null,
    enabled: !!year && !!month,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Hook to get all monthly budgets for a year
 */
export function useYearBudgets(year: number) {
  return useQuery({
    queryKey: ['monthlyBudget', 'year', year],
    queryFn: () => MonthlyBudgetService.getYearBudgets(year),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to get all monthly budgets (recent history)
 */
export function useAllMonthlyBudgets(limit: number = 12) {
  return useQuery({
    queryKey: ['monthlyBudget', 'all', limit],
    queryFn: () => MonthlyBudgetService.getAllMonthlyBudgets(limit),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to get monthly budgets for a date range
 */
export function useMonthlyBudgetsForDateRange(startDate?: Date, endDate?: Date) {
  return useQuery({
    queryKey: ['monthlyBudget', 'dateRange', startDate?.toISOString(), endDate?.toISOString()],
    queryFn: () => startDate && endDate ? MonthlyBudgetService.getMonthlyBudgetsForDateRange(startDate, endDate) : [],
    enabled: !!startDate && !!endDate,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Hook to update a category limit in a monthly budget
 */
export function useUpdateCategoryLimit() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ 
      monthlyBudgetId, 
      categoryName, 
      newLimit, 
      notes 
    }: {
      monthlyBudgetId: string;
      categoryName: string;
      newLimit: number;
      notes?: string;
    }) => MonthlyBudgetService.updateCategoryLimit(monthlyBudgetId, categoryName, newLimit, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthlyBudget'] });
    },
  });
}

/**
 * Hook to lock a monthly budget
 */
export function useLockMonthlyBudget() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ year, month }: { year: number; month: number }) =>
      MonthlyBudgetService.lockMonthlyBudget(year, month),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthlyBudget'] });
    },
  });
}

/**
 * Hook to unlock a monthly budget
 */
export function useUnlockMonthlyBudget() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ year, month }: { year: number; month: number }) =>
      MonthlyBudgetService.unlockMonthlyBudget(year, month),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthlyBudget'] });
    },
  });
}

/**
 * Hook to compare monthly budget to personal budget
 */
export function useBudgetComparison(year?: number, month?: number) {
  return useQuery({
    queryKey: ['budgetComparison', year, month],
    queryFn: () => year && month ? MonthlyBudgetService.compareToPersonalBudget(year, month) : null,
    enabled: !!year && !!month,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Hook to compare monthly budget to its original state
 * Shows in-month changes (adjustments made after month started)
 */
export function useBudgetComparisonToOriginal(year?: number, month?: number) {
  return useQuery({
    queryKey: ['budgetComparison', 'original', year, month],
    queryFn: () => year && month ? MonthlyBudgetService.compareToOriginal(year, month) : null,
    enabled: !!year && !!month,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Hook to get pending adjustments for a specific month
 */
export function usePendingAdjustments(year?: number, month?: number) {
  return useQuery({
    queryKey: ['budgetAdjustments', 'pending', year, month],
    queryFn: () => year && month ? BudgetAdjustmentService.getPendingAdjustments(year, month) : [],
    enabled: !!year && !!month,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

/**
 * Hook to get pending adjustments effective on or before a month (for projected budgets)
 */
export function usePendingAdjustmentsThrough(year?: number, month?: number) {
  return useQuery({
    queryKey: ['budgetAdjustments', 'pendingThrough', year, month],
    queryFn: () => year && month ? BudgetAdjustmentService.getPendingAdjustmentsThrough(year, month) : [],
    enabled: !!year && !!month,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

/**
 * Hook to get next month's pending adjustments summary
 */
export function useNextMonthAdjustments() {
  return useQuery({
    queryKey: ['budgetAdjustments', 'nextMonth'],
    queryFn: () => BudgetAdjustmentService.getNextMonthAdjustments(),
    staleTime: 1 * 60 * 1000,
  });
}

/**
 * Hook to check if there are pending adjustments for next month
 */
export function useHasPendingNextMonthAdjustments() {
  return useQuery({
    queryKey: ['budgetAdjustments', 'hasPendingNextMonth'],
    queryFn: () => BudgetAdjustmentService.hasPendingNextMonthAdjustments(),
    staleTime: 1 * 60 * 1000,
  });
}

/**
 * Hook to schedule a budget adjustment
 */
export function useScheduleAdjustment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ 
      categoryName, 
      currentLimit, 
      newLimit, 
      reason 
    }: {
      categoryName: string;
      currentLimit: number;
      newLimit: number;
      reason?: string;
    }) => BudgetAdjustmentService.scheduleAdjustment(categoryName, currentLimit, newLimit, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgetAdjustments'] });
    },
  });
}

/**
 * Hook to cancel a pending adjustment
 */
export function useCancelAdjustment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (adjustmentId: string) => BudgetAdjustmentService.cancelAdjustment(adjustmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgetAdjustments'] });
    },
  });
}

/**
 * Hook to apply scheduled adjustments for a month
 */
export function useApplyScheduledAdjustments() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ year, month }: { year: number; month: number }) =>
      BudgetAdjustmentService.applyScheduledAdjustments(year, month),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgetAdjustments'] });
      queryClient.invalidateQueries({ queryKey: ['monthlyBudget'] });
      queryClient.invalidateQueries({ queryKey: ['personalBudget'] });
    },
  });
}

/**
 * Hook to get category adjustment history
 */
export function useCategoryHistory(categoryName?: string) {
  return useQuery({
    queryKey: ['categoryHistory', categoryName],
    queryFn: () => categoryName ? BudgetAdjustmentService.getCategoryHistory(categoryName) : null,
    enabled: !!categoryName,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to get most adjusted categories
 */
export function useMostAdjustedCategories(limit: number = 5) {
  return useQuery({
    queryKey: ['categoryHistory', 'mostAdjusted', limit],
    queryFn: () => BudgetAdjustmentService.getMostAdjustedCategories(limit),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to automatically check and apply pending adjustments on app load
 * This runs once when the component mounts and checks if there are
 * pending adjustments for the current month that need to be applied.
 */
export function useAutoApplyScheduledAdjustments(isAuthenticated: boolean = true) {
  const queryClient = useQueryClient();
  const hasApplied = useRef(false);
  
  useEffect(() => {
    // Only run once per app session, and only when authenticated
    if (hasApplied.current || !isAuthenticated) {
      return;
    }

    const checkAndApply = async () => {
      try {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1; // 1-indexed

        // Check if there are pending adjustments for this month
        const pendingAdjustments = await BudgetAdjustmentService.getPendingAdjustments(year, month);
        
        if (pendingAdjustments.length > 0) {
          // Apply them
          await BudgetAdjustmentService.applyScheduledAdjustments(year, month);
          hasApplied.current = true;
          
          // Invalidate all budget-related queries to refresh the UI
          await queryClient.invalidateQueries({ queryKey: ['budgetAdjustments'] });
          await queryClient.invalidateQueries({ queryKey: ['monthlyBudget'] });
          await queryClient.invalidateQueries({ queryKey: ['personalBudget'] });
          
          // Force refetch of active budget
          await queryClient.refetchQueries({ queryKey: ['personalBudget', 'active'] });
        } else {
          hasApplied.current = true; // Don't check again
        }
      } catch (error) {
        // Silent fail or report to error monitoring service
      }
    };

    // Small delay to ensure queries are ready
    const timer = setTimeout(checkAndApply, 1500);
    return () => clearTimeout(timer);
  }, [isAuthenticated, queryClient]);

  return null;
}
