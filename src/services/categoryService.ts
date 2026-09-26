// Category Service for the new UUID-based category system
// Part of Category Management Restructure (Phase 1)
// See: docs/CATEGORY_MANAGEMENT_RESTRUCTURE.md

import { supabase } from '../lib/supabase';
import type { 
  Category, 
  CategoryCreateInput, 
  CategoryUpdateInput,
  CategoryMergeResult,
  CategoryMergeHistoryEntry
} from '../types/category';

// ==================== HELPERS ====================

const getCurrentUserId = async (): Promise<string> => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error('User not authenticated');
  }
  return user.id;
};

const getHouseholdId = async (): Promise<string | null> => {
  try {
    const userId = await getCurrentUserId();
    const { data } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', userId)
      .single();
    return data?.household_id || null;
  } catch {
    return null;
  }
};

// Map database row to Category type
const mapRowToCategory = (row: Record<string, unknown>): Category => ({
  id: row.id as string,
  userId: row.user_id as string,
  householdId: row.household_id as string | undefined,
  name: row.name as string,
  type: (row.type as 'expense' | 'income') || 'expense',
  color: row.color as string || '#3B82F6',
  description: row.description as string | undefined,
  icon: row.icon as string | undefined,
  monthlyLimit: parseFloat(row.monthly_limit as string) || 0,
  warningThreshold: row.warning_threshold as number || 80,
  isActive: row.is_active as boolean,
  isSystem: row.is_system as boolean,
  sortOrder: row.sort_order as number || 0,
  deletedAt: row.deleted_at as string | undefined,
  deletedReason: row.deleted_reason as 'merged' | 'user_deleted' | undefined,
  mergedIntoId: row.merged_into_id as string | undefined,
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string,
});

// ==================== CRUD OPERATIONS ====================

/**
 * Get all active categories for the current user
 * For users in a household, shows categories owned by the user.
 * Household-shared categories are accessed via household_id.
 * @param includeDeleted - Include soft-deleted categories
 * @param type - Filter by category type ('expense' or 'income')
 */
export const getCategories = async (
  includeDeleted = false,
  type?: 'expense' | 'income'
): Promise<Category[]> => {
  const userId = await getCurrentUserId();
  const householdId = await getHouseholdId();
  
  // Build query - get categories owned by user OR shared in their household
  let query = supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  
  // Filter by user or household
  if (householdId) {
    // In a household: show categories that belong to the household
    query = query.eq('household_id', householdId);
  } else {
    // No household: show only user's own categories
    query = query.eq('user_id', userId);
  }
  
  if (!includeDeleted) {
    query = query.is('deleted_at', null);
  }
  
  if (type) {
    query = query.eq('type', type);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('Error fetching categories:', error);
    throw error;
  }
  
  // Deduplicate by name (keep the one with household_id if exists, otherwise first)
  const categoryMap = new Map<string, Category>();
  for (const row of data || []) {
    const category = mapRowToCategory(row);
    const existing = categoryMap.get(category.name.toLowerCase());
    if (!existing) {
      categoryMap.set(category.name.toLowerCase(), category);
    } else if (category.householdId && !existing.householdId) {
      // Prefer the household version
      categoryMap.set(category.name.toLowerCase(), category);
    }
  }
  
  return Array.from(categoryMap.values());
};

/**
 * Get a single category by ID
 */
export const getCategoryById = async (categoryId: string): Promise<Category | null> => {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('id', categoryId)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }
  
  return data ? mapRowToCategory(data) : null;
};

/**
 * Get a category by name (case-insensitive)
 */
export const getCategoryByName = async (name: string): Promise<Category | null> => {
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .ilike('name', name)
    .is('deleted_at', null)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }
  
  return data ? mapRowToCategory(data) : null;
};

/**
 * Create a new category
 */
export const createCategory = async (input: CategoryCreateInput): Promise<Category> => {
  const userId = await getCurrentUserId();
  const householdId = input.householdId || await getHouseholdId();
  
  const { data, error } = await supabase
    .from('categories')
    .insert({
      user_id: userId,
      household_id: householdId,
      name: input.name,
      type: input.type || 'expense',
      color: input.color || '#3B82F6',
      description: input.description,
      icon: input.icon,
      monthly_limit: input.monthlyLimit || 0,
      warning_threshold: input.warningThreshold || 80,
      is_active: input.isActive ?? true,
      sort_order: input.sortOrder || 0,
      is_system: false,
    })
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to create category: ${error.message}`);
  }
  
  return mapRowToCategory(data);
};

/**
 * Update an existing category
 */
export const updateCategory = async (
  categoryId: string, 
  input: CategoryUpdateInput
): Promise<Category> => {
  const updateData: Record<string, unknown> = {};
  
  if (input.name !== undefined) updateData.name = input.name;
  if (input.color !== undefined) updateData.color = input.color;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.icon !== undefined) updateData.icon = input.icon;
  if (input.monthlyLimit !== undefined) updateData.monthly_limit = input.monthlyLimit;
  if (input.warningThreshold !== undefined) updateData.warning_threshold = input.warningThreshold;
  if (input.isActive !== undefined) updateData.is_active = input.isActive;
  if (input.sortOrder !== undefined) updateData.sort_order = input.sortOrder;
  
  const { data, error } = await supabase
    .from('categories')
    .update(updateData)
    .eq('id', categoryId)
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to update category: ${error.message}`);
  }
  
  return mapRowToCategory(data);
};

/**
 * Rename a category
 * This is the key feature that was missing with string-based categories
 */
export const renameCategory = async (
  categoryId: string, 
  newName: string
): Promise<Category> => {
  return updateCategory(categoryId, { name: newName });
};

/**
 * Soft-delete a category
 */
export const deleteCategory = async (
  categoryId: string,
  reason: 'user_deleted' | 'merged' = 'user_deleted'
): Promise<void> => {
  const { error } = await supabase
    .from('categories')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_reason: reason,
      is_active: false,
    })
    .eq('id', categoryId);
  
  if (error) {
    throw new Error(`Failed to delete category: ${error.message}`);
  }
};

/**
 * Restore a soft-deleted category
 */
export const restoreCategory = async (categoryId: string): Promise<Category> => {
  const { data, error } = await supabase
    .from('categories')
    .update({
      deleted_at: null,
      deleted_reason: null,
      is_active: true,
    })
    .eq('id', categoryId)
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to restore category: ${error.message}`);
  }
  
  return mapRowToCategory(data);
};

// ==================== MERGE OPERATIONS ====================

/**
 * Merge one category into another
 * Uses the database function for atomic operation with history tracking
 */
export const mergeCategories = async (
  sourceCategoryId: string,
  targetCategoryId: string,
  reason?: string
): Promise<CategoryMergeResult> => {
  const { data, error } = await supabase
    .rpc('merge_categories', {
      p_source_category_id: sourceCategoryId,
      p_target_category_id: targetCategoryId,
      p_merge_reason: reason,
    });
  
  if (error) {
    throw new Error(`Failed to merge categories: ${error.message}`);
  }
  
  const result = data[0];
  return {
    mergeId: result.merge_id,
    transactionsUpdated: result.transactions_updated,
    monthlyBudgetsUpdated: result.monthly_budgets_updated,
    sourceDeleted: result.source_deleted,
  };
};

/**
 * Undo a category merge
 */
export const undoCategoryMerge = async (mergeId: string): Promise<{
  success: boolean;
  transactionsReverted: number;
  monthlyBudgetsReverted: number;
  sourceRestored: boolean;
}> => {
  const { data, error } = await supabase
    .rpc('undo_category_merge', {
      p_merge_id: mergeId,
    });
  
  if (error) {
    throw new Error(`Failed to undo category merge: ${error.message}`);
  }
  
  const result = data[0];
  return {
    success: result.success,
    transactionsReverted: result.transactions_reverted,
    monthlyBudgetsReverted: result.monthly_budgets_reverted,
    sourceRestored: result.source_restored,
  };
};

/**
 * Get merge history for the current user
 */
export const getMergeHistory = async (): Promise<CategoryMergeHistoryEntry[]> => {
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('category_merge_history')
    .select('*')
    .eq('user_id', userId)
    .order('merged_at', { ascending: false });
  
  if (error) {
    throw new Error(`Failed to get merge history: ${error.message}`);
  }
  
  return (data || []).map(row => ({
    id: row.id,
    userId: row.user_id,
    householdId: row.household_id,
    sourceCategoryId: row.source_category_id,
    targetCategoryId: row.target_category_id,
    sourceCategoryName: row.source_category_name,
    sourceCategoryColor: row.source_category_color,
    sourceCategoryMonthlyLimit: row.source_category_monthly_limit ? parseFloat(row.source_category_monthly_limit) : undefined,
    sourceCategorySettings: row.source_category_settings,
    transactionsAffected: row.transactions_affected,
    monthlyBudgetsAffected: row.monthly_budgets_affected,
    mergedAt: row.merged_at,
    mergedBy: row.merged_by,
    mergeReason: row.merge_reason,
    undoneAt: row.undone_at,
    undoneBy: row.undone_by,
  }));
};

// ==================== MIGRATION OPERATIONS ====================

/**
 * Check if the current user has migrated to the new category system
 */
export const isCategoryMigrationComplete = async (): Promise<boolean> => {
  const userId = await getCurrentUserId();
  
  // Check if there are any transactions with category_id set
  const { count: transactionsWithId } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .not('category_id', 'is', null);
  
  // Check if there are any transactions without category_id
  const { count: transactionsWithoutId } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('category_id', null)
    .not('category', 'is', null);
  
  // Migration is complete if all categorized transactions have category_id
  return (transactionsWithId || 0) > 0 && (transactionsWithoutId || 0) === 0;
};

// ==================== UTILITY FUNCTIONS ====================

/**
 * Get or create a category by name
 * Useful during dual-write period
 */
export const getOrCreateCategory = async (
  name: string,
  defaults?: Partial<CategoryCreateInput>
): Promise<Category> => {
  // Try to find existing category
  const existing = await getCategoryByName(name);
  if (existing) {
    return existing;
  }
  
  // Create new category with defaults
  return createCategory({
    name,
    ...defaults,
  });
};

/**
 * Get category ID for a category name
 * Returns null if category doesn't exist (for backward compatibility)
 */
export const getCategoryIdByName = async (name: string): Promise<string | null> => {
  const category = await getCategoryByName(name);
  return category?.id || null;
};

/**
 * Bulk update sort order for categories
 */
export const updateCategorySortOrder = async (
  categoryIds: string[]
): Promise<void> => {
  const updates = categoryIds.map((id, index) => ({
    id,
    sort_order: index,
  }));
  
  for (const update of updates) {
    await supabase
      .from('categories')
      .update({ sort_order: update.sort_order })
      .eq('id', update.id);
  }
};
