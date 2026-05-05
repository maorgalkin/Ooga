export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  category_id?: string;  // UUID reference to categories table (Phase 2+)
  type: 'income' | 'expense';
  familyMember?: string;
  installment_group_id?: string;  // UUID linking all transactions in an installment series
  installment_number?: number;    // Current installment number (1-based)
  installment_total?: number;     // Total number of installments
}

export interface Budget {
  id: string;
  category: string;
  budgetAmount: number;
  spentAmount: number;
  month: string;
  year: number;
}

export interface FamilyMember {
  id: string;
  name: string;
  color: string;
  household_member_id?: string | null;  // Optional link to household_member (app user)
}

export interface CategorySummary {
  category: string;
  amount: number;
  percentage: number;
}

export interface BudgetConfiguration {
  version: string;
  lastUpdated: string;
  categories: {
    [categoryName: string]: {
      monthlyLimit: number;
      warningThreshold: number; // Percentage (e.g., 80 for 80%)
      isActive: boolean;
      color?: string;
      description?: string;
    };
  };
  globalSettings: {
    currency: string;
    warningNotifications: boolean;
    emailAlerts: boolean;
  };
}

export interface BudgetCutoff {
  id: string;
  category: string;
  monthlyLimit: number;
  warningThreshold: number; // Percentage (e.g., 80 for 80%)
  isActive: boolean;
}

// Re-export budget types for convenience
export type {
  BudgetTemplate,
  BudgetCategory,
  FamilyMemberBudget,
  IncomeTarget,
  BudgetComparison,
  BudgetAnalysis,
  BudgetAlert,
  EnhancedBudget
} from './budget';

// Re-export category types
export type {
  Category,
  CategoryCreateInput,
  CategoryUpdateInput,
  CategoryMergeResult,
  CategoryMergeHistoryEntry,
  CategoryMigrationResult
} from './category';

export { DEFAULT_CATEGORY_COLORS, getNextCategoryColor } from './category';

export interface BankImportSession {
  id: string;
  user_id: string;
  household_id: string;
  status: 'pending' | 'logging_in' | 'awaiting_otp' | 'importing' | 'complete' | 'error';
  started_at: string;
  completed_at: string | null;
  date_range_start: string | null;
  date_range_end: string | null;
  transactions_imported: number;
  transactions_skipped: number;
  error_message: string | null;
}
