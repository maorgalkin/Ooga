// Budget Configuration Types for Ooga Finance Tracker
// These interfaces define the structure for budget templates and configuration

export interface BudgetCategory {
  monthlyLimit: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  alertThreshold: number; // Percentage (0-100)
  description: string;
  subcategories: string[];
}

export interface FamilyMemberBudget {
  monthlyAllowance: number;
  categories: string[];
  alertThreshold: number;
}

export interface IncomeTarget {
  monthlyTarget: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  description: string;
}

export interface AlertConfig {
  enabled: boolean;
  severity: 'high' | 'medium' | 'low';
  message: string;
}

export interface SavingsGoal {
  target: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  monthlyTarget: number;
}

export interface BudgetTemplate {
  version: string;
  currency: string;
  created: string;
  description: string;
  
  monthlyBudgets: {
    totalMonthlyLimit: number;
    categories: Record<string, BudgetCategory>;
  };
  
  familyMemberBudgets: {
    enabled: boolean;
    individual: Record<string, FamilyMemberBudget>;
  };
  
  incomeTargets: {
    monthlyTarget: number;
    categories: Record<string, IncomeTarget>;
  };
  
  alerts: {
    enabled: boolean;
    types: Record<string, AlertConfig>;
  };
  
  savingsGoals: {
    enabled: boolean;
    emergency: SavingsGoal;
    vacation: SavingsGoal;
    homeImprovement: SavingsGoal;
  };
  
  reporting: {
    comparisonPeriods: string[];
    metrics: Record<string, boolean>;
    exportFormats: string[];
  };
  
  settings: {
    autoAdjustBudgets: boolean;
    inflationAdjustment: number;
    reviewPeriod: string;
    rolloverUnusedBudget: boolean;
    strictMode: boolean;
  };
}

// Enhanced Budget interface that extends the existing one
export interface EnhancedBudget extends Budget {
  alertThreshold?: number;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  subcategories?: string[];
  rolloverAmount?: number;
  lastAdjusted?: string;
}

// Budget comparison and analysis types
export interface BudgetComparison {
  category: string;
  budgeted: number;
  actual: number;
  variance: number;
  variancePercentage: number;
  status: 'under' | 'over' | 'onTarget';
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface BudgetAnalysis {
  month: string;
  year: number;
  totalBudgeted: number;
  totalSpent: number;
  totalVariance: number;
  categoryComparisons: BudgetComparison[];
  savingsRate: number;
  incomeExpenseRatio: number;
  alerts: BudgetAlert[];
}

export interface BudgetAlert {
  id: string;
  type: 'budgetExceeded' | 'approachingLimit' | 'incomeShortfall' | 'unusualSpending';
  severity: 'high' | 'medium' | 'low';
  category: string;
  message: string;
  amount: number;
  percentage?: number;
  date: string;
  acknowledged: boolean;
}

// Utility functions type definitions
export interface BudgetUtils {
  loadBudgetTemplate: () => BudgetTemplate;
  calculateBudgetVariance: (category: string, month: string, year: number) => BudgetComparison;
  generateBudgetAlerts: (month: string, year: number) => BudgetAlert[];
  getBudgetStatus: (category: string, spent: number, budgeted: number) => 'under' | 'over' | 'onTarget';
  calculateSavingsRate: (income: number, expenses: number) => number;
  adjustBudgetForInflation: (amount: number, rate: number) => number;
  validateBudgetConfig: (template: BudgetTemplate) => boolean;
}

// Import the original Budget interface from existing types
import type { Budget } from './index';

// ============================================================================
// BUDGET ADJUSTMENT SYSTEM TYPES (v2.0)
// ============================================================================

/**
 * Personal Budget - User's baseline/ideal budget configuration
 * This serves as the reference point for all monthly budgets
 */
export interface PersonalBudget {
  id: string;
  user_id: string;
  household_id: string;
  version: number;
  name: string;
  categories: Record<string, CategoryConfig>;
  global_settings: GlobalBudgetSettings;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  notes?: string;
}

/**
 * Monthly Budget - Active budget for a specific month
 * Inherits from Personal Budget but can be adjusted
 */
export interface MonthlyBudget {
  id: string;
  user_id: string;
  household_id: string;
  personal_budget_id: string | null;
  year: number;
  month: number; // 1-12
  categories: Record<string, CategoryConfig>; // Current state (may be adjusted during month)
  original_categories: Record<string, CategoryConfig>; // Snapshot at month creation (starting point)
  global_settings: GlobalBudgetSettings;
  adjustment_count: number;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
  notes?: string;
}

/**
 * Budget Adjustment - Scheduled changes for next month
 * When applied, updates the Personal Budget
 */
export interface BudgetAdjustment {
  id: string;
  user_id: string;
  household_id: string;
  category_name: string;
  current_limit: number;
  adjustment_type: 'increase' | 'decrease';
  adjustment_amount: number;
  new_limit: number;
  effective_year: number;
  effective_month: number;
  reason?: string;
  is_applied: boolean;
  created_at: string;
  applied_at?: string;
  created_by_user_id?: string;
}

/**
 * Category Adjustment History - Tracks how often categories are adjusted
 * Used for insights and gamification
 */
export interface CategoryAdjustmentHistory {
  id: string;
  user_id: string;
  category_name: string;
  adjustment_count: number;
  last_adjusted_at?: string;
  total_increased_amount: number;
  total_decreased_amount: number;
  first_adjustment_at?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Category Configuration - Detailed category budget settings
 */
export interface CategoryConfig {
  monthlyLimit: number;
  warningThreshold: number; // Percentage (0-100)
  isActive: boolean;
  color?: string;
  description?: string;
  priority?: 'critical' | 'high' | 'medium' | 'low';
}

/**
 * Global Budget Settings - Application-wide budget preferences
 */
export interface GlobalBudgetSettings {
  currency: string;
  warningNotifications: boolean;
  emailAlerts: boolean;
  showRoundedAmounts: boolean; // Display rounded amounts (no decimals) by default
  familyMembers: Array<{
    id: string;
    name: string;
    color: string;
  }>;
  activeExpenseCategories: string[];
}

/**
 * Budget Comparison Result - Comparison between two budgets
 */
export interface BudgetComparisonResult {
  category: string;
  personalLimit: number | null; // null if category doesn't exist in personal budget
  monthlyLimit: number;
  difference: number;
  differencePercentage: number;
  status: 'increased' | 'decreased' | 'unchanged' | 'added' | 'removed';
  isActive: boolean; // Whether category is active in monthly budget
}

/**
 * Budget Comparison Summary - Full comparison between Personal and Monthly
 */
export interface BudgetComparisonSummary {
  personalBudgetName: string;
  monthlyBudgetDate: string; // "October 2025"
  currency: string; // "USD", "ILS", etc.
  totalCategories: number;
  activeCategories: number;
  adjustedCategories: number;
  addedCategories: number; // Categories in monthly but not in personal
  removedCategories: number; // Categories deactivated in monthly
  comparisons: BudgetComparisonResult[];
  totalPersonalLimit: number; // Active categories only
  totalMonthlyLimit: number; // Active categories only
  totalDifference: number;
}

/**
 * Pending Adjustments Summary - Overview of scheduled adjustments
 */
export interface PendingAdjustmentsSummary {
  effectiveDate: string; // "November 2025"
  adjustmentCount: number;
  totalIncrease: number;
  totalDecrease: number;
  netChange: number;
  adjustments: BudgetAdjustment[];
}

/**
 * Category Insights - Analytics for a specific category
 */
export interface CategoryInsights {
  categoryName: string;
  currentLimit: number;
  adjustmentCount: number;
  averageAdjustment: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  lastAdjusted?: string;
  totalIncreased: number;
  totalDecreased: number;
  recommendation?: string;
}

/**
 * Budget Discipline Score - Gamification metric
 */
export interface BudgetDisciplineScore {
  score: number; // 0-100
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  monthsTracked: number;
  adjustmentFrequency: number;
  adherenceRate: number; // Percentage of months staying within budget
  achievements: string[];
  nextMilestone: string;
}
