import type { 
  BudgetTemplate, 
  BudgetComparison, 
  BudgetAnalysis, 
  BudgetAlert
} from '../types/budget';
import type { Transaction, BudgetConfiguration } from '../types/index';
import { budgetTemplate } from '../config/budgetTemplate';

/**
 * Budget Configuration Service
 * Handles budget template loading, calculations, and analysis
 * 
 * NOTE: This service has been migrated to work with PersonalBudget configurations
 * passed as parameters rather than loading from localStorage.
 */
export class BudgetService {
  private budgetTemplate: BudgetTemplate;

  constructor() {
    this.budgetTemplate = budgetTemplate;
  }

  /**
   * Load the budget template configuration
   */
  getBudgetTemplate(): BudgetTemplate {
    return this.budgetTemplate;
  }

  /**
   * Calculate budget variance for a category with provided config
   */
  calculateBudgetVarianceWithConfig(
    category: string, 
    actualSpent: number,
    config: BudgetConfiguration
  ): BudgetComparison {
    const categoryConfig = config.categories[category];
    const budgeted = categoryConfig?.monthlyLimit || 0;
    const warningThreshold = categoryConfig?.warningThreshold || 80;
    const variance = actualSpent - budgeted;
    const variancePercentage = budgeted > 0 ? (variance / budgeted) * 100 : 0;
    
    let status: 'under' | 'over' | 'near' = 'near';
    const warningAmount = budgeted * (warningThreshold / 100);
    
    if (actualSpent > budgeted) {
      status = 'over';
    } else if (actualSpent >= warningAmount) {
      status = 'near';
    } else {
      status = 'under';
    }

    return {
      category,
      budgeted,
      actual: actualSpent,
      variance,
      variancePercentage,
      status,
      trend: 'stable' // Would need historical data to calculate actual trend
    };
  }

  /**
   * Analyze budget performance for a specific month with provided config
   */
  analyzeBudgetPerformanceWithConfig(
    transactions: Transaction[], 
    month: string, 
    year: number,
    config: BudgetConfiguration
  ): BudgetAnalysis {
    // Filter transactions for the specific month/year
    const monthTransactions = transactions.filter(t => {
      const date = new Date(t.date);
      return date.getMonth() === new Date(`${month} 1, ${year}`).getMonth() && 
             date.getFullYear() === year &&
             t.type === 'expense';
    });

    // Calculate spending by category
    const categorySpending: Record<string, number> = {};
    monthTransactions.forEach(t => {
      categorySpending[t.category] = (categorySpending[t.category] || 0) + t.amount;
    });

    // Generate category comparisons (only for active categories)
    const categoryComparisons: BudgetComparison[] = [];
    for (const [category, categoryConfig] of Object.entries(config.categories)) {
      if (categoryConfig.isActive) {
        const spent = categorySpending[category] || 0;
        const comparison = this.calculateBudgetVarianceWithConfig(category, spent, config);
        categoryComparisons.push(comparison);
      }
    }

    // Calculate totals (only for active categories)
    const totalBudgeted = Object.entries(config.categories)
      .filter(([, categoryConfig]) => categoryConfig.isActive)
      .reduce((sum, [, categoryConfig]) => sum + categoryConfig.monthlyLimit, 0);
    
    // Calculate total spent (only for active categories)
    const totalSpent = Object.entries(categorySpending)
      .filter(([category]) => config.categories[category]?.isActive)
      .reduce((sum, [, amount]) => sum + amount, 0);
    
    const totalVariance = totalSpent - totalBudgeted;

    // Calculate income for the month
    const monthIncome = transactions
      .filter(t => {
        const date = new Date(t.date);
        return date.getMonth() === new Date(`${month} 1, ${year}`).getMonth() && 
               date.getFullYear() === year &&
               t.type === 'income';
      })
      .reduce((sum, t) => sum + t.amount, 0);

    const savingsRate = monthIncome > 0 ? ((monthIncome - totalSpent) / monthIncome) * 100 : 0;
    const incomeExpenseRatio = totalSpent > 0 ? monthIncome / totalSpent : 0;

    // Generate alerts
    const alerts = this.generateBudgetAlertsWithConfig(categoryComparisons, month, year, config);

    return {
      month,
      year,
      totalBudgeted,
      totalSpent,
      totalVariance,
      categoryComparisons,
      savingsRate,
      incomeExpenseRatio,
      alerts
    };
  }

  /**
   * At most one alert per active category: `budgetExceeded` past its limit, `approachingLimit` at
   * or past its warning threshold. None at all when the budget's "Warning notifications" is off.
   * Which alerts a person has already seen is tracked separately (hooks/useBudgetAlerts).
   */
  generateBudgetAlertsWithConfig(
    comparisons: BudgetComparison[], 
    month: string, 
    year: number,
    config: BudgetConfiguration
  ): BudgetAlert[] {
    const alerts: BudgetAlert[] = [];

    if (!config.globalSettings.warningNotifications) {
      return alerts;
    }

    comparisons.forEach(comparison => {
      const categoryConfig = config.categories[comparison.category];
      if (!categoryConfig || !categoryConfig.isActive) return;

      const spentPercentage = (comparison.actual / comparison.budgeted) * 100;
      const warningThreshold = categoryConfig.warningThreshold;

      // Budget exceeded alert
      if (comparison.status === 'over') {
        alerts.push({
          id: `exceeded-${comparison.category}-${month}-${year}`,
          type: 'budgetExceeded',
          severity: 'high',
          category: comparison.category,
          message: `Budget exceeded for ${comparison.category}. Spent ${comparison.actual.toFixed(2)} ${config.globalSettings.currency} of ${comparison.budgeted.toFixed(2)} ${config.globalSettings.currency} budget.`,
          amount: comparison.variance,
          percentage: comparison.variancePercentage,
          date: new Date().toISOString(),
          acknowledged: false
        });
      }
      // Approaching limit alert - only if NOT already over budget
      else if (spentPercentage >= warningThreshold && 
          spentPercentage < 100) {
        alerts.push({
          id: `approaching-${comparison.category}-${month}-${year}`,
          type: 'approachingLimit',
          severity: 'medium',
          category: comparison.category,
          message: `Budget warning for ${comparison.category}. You've spent ${Math.round(spentPercentage)}% of your budget.`,
          amount: comparison.actual,
          percentage: spentPercentage,
          date: new Date().toISOString(),
          acknowledged: false
        });
      }
    });

    return alerts;
  }
}

// Export singleton instance
export const budgetService = new BudgetService();
