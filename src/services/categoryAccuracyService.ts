import type { Transaction } from '../types';
import type { PersonalBudget } from '../types/budget';
import type { CategoryAccuracy, AccuracyZone, AccuracyZoneConfig } from '../types/analytics';
import { DEFAULT_ACCURACY_ZONES } from '../types/analytics';
import { monthlyBudgetService } from './monthlyBudgetService';
import { parseTransactionDate } from '../utils/dateHelpers';

/**
 * Service for calculating category spending accuracy metrics
 */
class CategoryAccuracyService {
  /**
   * Calculate accuracy metrics for all active categories over a date range
   */
  async calculateCategoryAccuracy(
    transactions: Transaction[],
    personalBudget: PersonalBudget | null | undefined,
    startDate: Date,
    endDate: Date,
    zoneConfig: AccuracyZoneConfig = DEFAULT_ACCURACY_ZONES
  ): Promise<CategoryAccuracy[]> {
    if (!personalBudget) {
      return [];
    }

    const accuracyData: CategoryAccuracy[] = [];
    const activeCategories = Object.entries(personalBudget.categories)
      .filter(([_, config]) => config.isActive)
      .map(([category]) => category);

    // Get monthly budgets for the date range
    const monthlyBudgets = await monthlyBudgetService.getMonthlyBudgetsForDateRange(
      startDate,
      endDate
    );

    // Calculate number of months in range
    const monthsInRange = this.getMonthsBetween(startDate, endDate);

    for (const category of activeCategories) {
      const accuracy = this.calculateCategoryMetrics(
        category,
        transactions,
        monthlyBudgets,
        monthsInRange,
        startDate,
        endDate,
        zoneConfig,
        personalBudget
      );
      accuracyData.push(accuracy);
    }

    return accuracyData;
  }

  /**
   * Calculate metrics for a single category
   */
  private calculateCategoryMetrics(
    category: string,
    transactions: Transaction[],
    monthlyBudgets: any[],
    monthsInRange: number,
    startDate: Date,
    endDate: Date,
    zoneConfig: AccuracyZoneConfig,
    personalBudget?: PersonalBudget
  ): CategoryAccuracy {
    // Calculate total budgeted amount across all months
    // Use original_categories to measure accuracy against the ORIGINAL plan (not mid-month edits)
    let totalBudgeted = monthlyBudgets.reduce((sum, mb) => {
      // Prefer original_categories (month-start snapshot), fallback to categories
      const originalCategories = mb.original_categories || mb.categories;
      const categoryConfig = originalCategories[category];
      return sum + (categoryConfig?.monthlyLimit || categoryConfig?.monthlyBudget || 0);
    }, 0);
    
    // If no monthly budgets exist, fall back to personal budget * months
    if (totalBudgeted === 0 && personalBudget?.categories[category]?.monthlyLimit) {
      totalBudgeted = personalBudget.categories[category].monthlyLimit * monthsInRange;
    }

    // Calculate total spent in the date range
    const categoryTransactions = transactions.filter(
      t => t.category === category &&
           t.type === 'expense' &&
           parseTransactionDate(t.date) >= startDate &&
           parseTransactionDate(t.date) <= endDate
    );

    const totalSpent = categoryTransactions.reduce((sum, t) => sum + t.amount, 0);
    const transactionCount = categoryTransactions.length;

    // Calculate day exceeded (for current month, when cumulative spending exceeded budget)
    const dayExceeded = this.calculateDayExceeded(
      categoryTransactions,
      personalBudget?.categories[category]?.monthlyLimit || 0,
      startDate,
      endDate
    );

    // Calculate averages
    const budgetAverage = monthsInRange > 0 ? totalBudgeted / monthsInRange : 0;
    const actualAverage = monthsInRange > 0 ? totalSpent / monthsInRange : 0;

    // Calculate variance
    const variance = actualAverage - budgetAverage;
    const variancePercentage = budgetAverage > 0 ? (variance / budgetAverage) * 100 : 0;

    // Calculate accuracy percentage (inverse of variance)
    // 100% = perfect match, higher = over budget, lower = under budget
    const accuracyPercentage = budgetAverage > 0 ? (actualAverage / budgetAverage) * 100 : 0;

    // Determine states
    const isOverBudget = actualAverage > budgetAverage;
    const isUnused = totalSpent === 0;

    // Determine accuracy zone and target position
    const { accuracyZone, targetPosition } = this.calculateZoneAndPosition(
      accuracyPercentage,
      isUnused,
      zoneConfig
    );
    
    // Get deterministic random angle for hit marker
    const hitAngle = this.getRandomAngleForCategory(category);

    return {
      category,
      budgetAverage,
      actualAverage,
      accuracyPercentage,
      variance,
      variancePercentage,
      isOverBudget,
      isUnused,
      monthsInRange,
      totalBudgeted,
      totalSpent,
      accuracyZone,
      targetPosition,
      hitAngle,
      transactionCount,
      dayExceeded,
    };
  }

  /**
   * Calculate the day of the month when spending exceeded the budget
   * Returns null if budget wasn't exceeded or if range spans multiple months
   */
  private calculateDayExceeded(
    transactions: Transaction[],
    monthlyLimit: number,
    startDate: Date,
    endDate: Date
  ): number | null {
    if (monthlyLimit <= 0 || transactions.length === 0) {
      return null;
    }

    // Only calculate for single-month ranges
    if (startDate.getMonth() !== endDate.getMonth() || startDate.getFullYear() !== endDate.getFullYear()) {
      return null;
    }

    // Sort transactions by date
    const sortedTransactions = [...transactions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Calculate cumulative spending
    let cumulative = 0;
    for (const t of sortedTransactions) {
      cumulative += t.amount;
      if (cumulative > monthlyLimit) {
        return parseTransactionDate(t.date).getDate();
      }
    }

    return null;
  }

  /**
   * Determine which accuracy zone the percentage falls into
   * and calculate the position on the target (0 = center, 1 = edge, >1 = bust)
   * 
   * New asymmetric model:
   * - Bullseye: 96-100% (position 0-0.17)
   * - Ring 1: 81-95% or 101-105% (position 0.17-0.33)
   * - Ring 2: 61-80% (position 0.33-0.5)
   * - Ring 3: 41-60% (position 0.5-0.67)
   * - Ring 4: 21-40% (position 0.67-0.83)
   * - Ring 5: 1-20% (position 0.83-1.0)
   * - Bust: >105% (position > 1.0)
   */
  private calculateZoneAndPosition(
    accuracyPercentage: number,
    isUnused: boolean,
    zoneConfig: AccuracyZoneConfig
  ): { accuracyZone: AccuracyZone; targetPosition: number } {
    if (isUnused) {
      return { accuracyZone: 'unused', targetPosition: 0 };
    }

    // Bullseye: 96-100% (perfect)
    if (accuracyPercentage >= zoneConfig.bullseye.min && accuracyPercentage <= zoneConfig.bullseye.max) {
      // 100% = center (0), 96% = edge of bullseye (0.17)
      const deviation = (100 - accuracyPercentage) / 4; // 4% range
      return { accuracyZone: 'bullseye', targetPosition: deviation * 0.17 };
    }

    // Ring 1 Upper: 101-105% (slightly over, still acceptable)
    if (accuracyPercentage >= zoneConfig.ring1Upper.min && accuracyPercentage <= zoneConfig.ring1Upper.max) {
      const deviation = (accuracyPercentage - 100) / 5; // 5% range
      return { accuracyZone: 'ring1', targetPosition: 0.17 + deviation * 0.16 };
    }

    // Ring 1 Lower: 81-95% (excellent underspend)
    if (accuracyPercentage >= zoneConfig.ring1Lower.min && accuracyPercentage <= zoneConfig.ring1Lower.max) {
      const deviation = (95 - accuracyPercentage) / 14; // 14% range (95-81)
      return { accuracyZone: 'ring1', targetPosition: 0.17 + deviation * 0.16 };
    }

    // Ring 2: 61-80%
    if (accuracyPercentage >= zoneConfig.ring2.min && accuracyPercentage <= zoneConfig.ring2.max) {
      const deviation = (80 - accuracyPercentage) / 19; // 19% range
      return { accuracyZone: 'ring2', targetPosition: 0.33 + deviation * 0.17 };
    }

    // Ring 3: 41-60%
    if (accuracyPercentage >= zoneConfig.ring3.min && accuracyPercentage <= zoneConfig.ring3.max) {
      const deviation = (60 - accuracyPercentage) / 19; // 19% range
      return { accuracyZone: 'ring3', targetPosition: 0.5 + deviation * 0.17 };
    }

    // Ring 4: 21-40%
    if (accuracyPercentage >= zoneConfig.ring4.min && accuracyPercentage <= zoneConfig.ring4.max) {
      const deviation = (40 - accuracyPercentage) / 19; // 19% range
      return { accuracyZone: 'ring4', targetPosition: 0.67 + deviation * 0.16 };
    }

    // Ring 5: 1-20% (edge of target)
    if (accuracyPercentage >= zoneConfig.ring5.min && accuracyPercentage <= zoneConfig.ring5.max) {
      const deviation = (20 - accuracyPercentage) / 19; // 19% range
      return { accuracyZone: 'ring5', targetPosition: 0.83 + deviation * 0.17 };
    }

    // Bust: >105% (over budget, outside target)
    if (accuracyPercentage > zoneConfig.ring1Upper.max) {
      const bustDistance = (accuracyPercentage - 105) / 100;
      return { accuracyZone: 'bust', targetPosition: 1.0 + Math.min(bustDistance, 0.5) };
    }

    // Edge case: 0% or negative (shouldn't happen but handle it)
    return { accuracyZone: 'ring5', targetPosition: 1.0 };
  }

  /**
   * Generate a deterministic pseudo-random angle based on category name
   * This ensures the same category always gets the same angle
   */
  private getRandomAngleForCategory(category: string): number {
    // Simple hash function to convert category name to a number
    let hash = 0;
    for (let i = 0; i < category.length; i++) {
      const char = category.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    // Convert to angle between 0 and 2π
    return (Math.abs(hash) % 360) * (Math.PI / 180);
  }

  /**
   * Calculate number of complete and partial months between two dates
   */
  private getMonthsBetween(startDate: Date, endDate: Date): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const yearsDiff = end.getFullYear() - start.getFullYear();
    const monthsDiff = end.getMonth() - start.getMonth();
    
    // Basic month count
    let months = yearsDiff * 12 + monthsDiff + 1; // +1 to include both start and end months
    
    return months;
  }

  /**
   * Get suggested action message for unused categories
   */
  getSuggestionMessage(_category: string, monthsInRange: number): string {
    const monthText = monthsInRange === 1 ? 'month' : `${monthsInRange} months`;
    return `This budget wasn't used throughout ${monthText}. Consider reallocating to other categories?`;
  }

  /**
   * Get performance label for a category based on its accuracy zone
   */
  getPerformanceLabel(accuracyZone: AccuracyZone): string {
    const labels: Record<AccuracyZone, string> = {
      bullseye: 'Perfect tracking',
      ring1: 'Excellent budgeting',
      ring2: 'Good control',
      ring3: 'Needs attention',
      ring4: 'Poor accuracy',
      ring5: 'Significantly under',
      bust: 'Over budget',
      unused: 'No activity',
    };
    return labels[accuracyZone];
  }
}

export const categoryAccuracyService = new CategoryAccuracyService();
