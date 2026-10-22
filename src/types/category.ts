// Category types for the new UUID-based category system
// Part of Category Management Restructure (Phase 1)
// See: docs/CATEGORY_MANAGEMENT_RESTRUCTURE.md

export type CategoryType = 'expense' | 'income';

export interface Category {
  id: string;  // UUID
  userId: string;
  householdId?: string;
  
  // Category properties
  name: string;
  type: CategoryType;  // expense or income
  color: string;
  description?: string;
  icon?: string;
  
  // Budget settings
  monthlyLimit: number;
  warningThreshold: number;  // Percentage (e.g., 80 for 80%)
  
  // State
  isActive: boolean;
  isSystem: boolean;  // Auto-generated during migration
  sortOrder: number;
  
  // Soft-delete tracking
  deletedAt?: string;
  deletedReason?: 'merged' | 'user_deleted';
  mergedIntoId?: string;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}

export interface CategoryCreateInput {
  name: string;
  type?: CategoryType;  // defaults to 'expense'
  color?: string;
  description?: string;
  icon?: string;
  monthlyLimit?: number;
  warningThreshold?: number;
  isActive?: boolean;
  sortOrder?: number;
  householdId?: string;
}

export interface CategoryUpdateInput {
  name?: string;
  color?: string;
  description?: string;
  icon?: string;
  monthlyLimit?: number;
  warningThreshold?: number;
  isActive?: boolean;
  sortOrder?: number;
}

export interface CategoryMergeResult {
  mergeId: string;
  transactionsUpdated: number;
  monthlyBudgetsUpdated: number;
  sourceDeleted: boolean;
}

export interface CategoryMergeHistoryEntry {
  id: string;
  userId: string;
  householdId?: string;
  sourceCategoryId: string;
  targetCategoryId: string;
  sourceCategoryName: string;
  sourceCategoryColor?: string;
  sourceCategoryMonthlyLimit?: number;
  sourceCategorySettings?: Record<string, unknown>;
  transactionsAffected: number;
  monthlyBudgetsAffected: number;
  mergedAt: string;
  mergedBy: string;
  mergeReason?: string;
  undoneAt?: string;
  undoneBy?: string;
}

// Default category colors for new categories
export const DEFAULT_CATEGORY_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#84CC16', // Lime
  '#6366F1', // Indigo
];

// Get a color for a new category based on existing categories
export function getNextCategoryColor(existingColors: string[]): string {
  const availableColors = DEFAULT_CATEGORY_COLORS.filter(
    color => !existingColors.includes(color.toLowerCase())
  );
  return availableColors[0] || DEFAULT_CATEGORY_COLORS[0];
}
