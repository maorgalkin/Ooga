// Category List Component
// Part of Category Management Restructure (Phase 4)
// Updated to use unified CategoryEditModal with adjustments

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Edit3,
  DollarSign,
  AlertTriangle,
  AlertCircle,
  Receipt,
  Calendar,
  TrendingUp,
  TrendingDown,
  X,
  Sparkles
} from 'lucide-react';
import { useCategories } from '../../hooks/useCategories';
import { useFinance } from '../../context/FinanceContext';
import { useNextMonthAdjustments, useCancelAdjustment, useActiveBudget, useCurrentMonthBudget } from '../../hooks/useBudgets';
import type { Category } from '../../types/category';
import { AddCategoryModal } from './AddCategoryModal';
import { CategoryEditModal } from './CategoryEditModal';
import { formatCurrencyFromSettings } from '../../utils/formatCurrency';

interface CategoryListProps {
  onCategorySelect?: (category: Category) => void;
  /** Category to auto-open for editing (e.g., when navigating from Overview) */
  initialEditCategory?: Category | null;
  onInitialEditHandled?: () => void;
}

export const CategoryList: React.FC<CategoryListProps> = ({
  initialEditCategory,
  onInitialEditHandled,
}) => {
  const { data: categories, isLoading, error } = useCategories(false, 'expense');
  const { transactions } = useFinance();
  const { data: nextMonthSummary } = useNextMonthAdjustments();
  const { data: activeBudget } = useActiveBudget();
  const { data: currentMonthBudget } = useCurrentMonthBudget();
  const cancelAdjustment = useCancelAdjustment();

  // Get the current month's limit for a category (from monthly budget, with fallback to category table)
  const getCurrentMonthLimit = (categoryName: string, fallbackLimit: number): number => {
    if (currentMonthBudget?.categories?.[categoryName]) {
      return currentMonthBudget.categories[categoryName].monthlyLimit;
    }
    return fallbackLimit;
  };
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [editInitialTab, setEditInitialTab] = useState<'edit' | 'adjustment'>('edit');

  // Handle initial edit category from navigation
  useEffect(() => {
    if (initialEditCategory) {
      setEditCategory(initialEditCategory);
      setEditInitialTab('edit');
      onInitialEditHandled?.();
    }
  }, [initialEditCategory, onInitialEditHandled]);

  // Get adjustment for a category by name
  const getCategoryAdjustment = (categoryName: string) => {
    return nextMonthSummary?.adjustments.find(adj => adj.category_name === categoryName);
  };

  // Get new category adjustments (categories that don't exist yet)
  const newCategoryAdjustments = useMemo(() => {
    if (!nextMonthSummary || !categories) return [];
    const existingNames = new Set(categories.map(c => c.name));
    return nextMonthSummary.adjustments.filter(adj => !existingNames.has(adj.category_name));
  }, [nextMonthSummary, categories]);

  // Calculate dynamic summary totals based on current month limits (not stored adjustment_amount)
  const dynamicSummary = useMemo(() => {
    if (!nextMonthSummary || !categories) {
      return { totalIncrease: 0, totalDecrease: 0, adjustmentCount: 0, effectiveDate: '' };
    }
    
    let totalIncrease = 0;
    let totalDecrease = 0;
    
    for (const adj of nextMonthSummary.adjustments) {
      // Find the category to get its current month limit
      const category = categories.find(c => c.name === adj.category_name);
      const currentLimit = category 
        ? getCurrentMonthLimit(category.name, category.monthlyLimit)
        : adj.current_limit; // Fallback for new categories
      
      const diff = adj.new_limit - currentLimit;
      if (diff > 0) {
        totalIncrease += diff;
      } else {
        totalDecrease += Math.abs(diff);
      }
    }
    
    return {
      totalIncrease,
      totalDecrease,
      adjustmentCount: nextMonthSummary.adjustmentCount,
      effectiveDate: nextMonthSummary.effectiveDate
    };
  }, [nextMonthSummary, categories, currentMonthBudget]);

  // Calculate transaction counts for each category
  // Matches by category_id (new) or category name (legacy)
  const getTransactionCount = (categoryId: string, categoryName: string): number => {
    return transactions.filter(t => 
      t.category_id === categoryId || t.category === categoryName
    ).length;
  };

  // Format currency
  const formatCurrency = (amount: number, currency?: string) => {
    const globalSettings = activeBudget?.global_settings;
    return formatCurrencyFromSettings(amount, currency ? { ...globalSettings, currency } : globalSettings);
  };

  const handleCancelAdjustment = async (adjustmentId: string) => {
    try {
      await cancelAdjustment.mutateAsync(adjustmentId);
    } catch (error) {
      console.error('Failed to cancel adjustment:', error);
    }
  };

  const handleEditWithTab = (category: Category, tab: 'edit' | 'adjustment') => {
    setEditInitialTab(tab);
    setEditCategory(category);
  };

  // Derive active categories (must be before useMemo that depends on it)
  const activeCategories = categories?.filter(c => c.isActive) || [];

  // Combined list: active categories + future categories from adjustments
  const allDisplayedCategories = useMemo(() => {
    const displayed: Array<{
      type: 'existing' | 'future';
      category?: Category;
      adjustment?: typeof newCategoryAdjustments[0];
      name: string;
    }> = [];

    // Add existing active categories
    activeCategories.forEach(cat => {
      displayed.push({ type: 'existing', category: cat, name: cat.name });
    });

    // Add future categories (adjustments for categories that don't exist yet)
    newCategoryAdjustments.forEach(adj => {
      displayed.push({ type: 'future', adjustment: adj, name: adj.category_name });
    });

    // Sort by name
    return displayed.sort((a, b) => a.name.localeCompare(b.name));
  }, [activeCategories, newCategoryAdjustments]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-500">Failed to load categories</p>
        <p className="text-sm text-gray-500 mt-2">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Add button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Your categories
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {activeCategories.length} active{newCategoryAdjustments.length > 0 ? `, ${newCategoryAdjustments.length} scheduled` : ''}
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add category
        </button>
      </div>

      {/* Category List */}
      {allDisplayedCategories.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600">
          <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-500 dark:text-gray-400 mb-2">
            No categories yet
          </h3>
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">
            Create your first category to start tracking expenses
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add category
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {allDisplayedCategories.map((item) => {
              if (item.type === 'existing' && item.category) {
                const category = item.category;
                const transactionCount = getTransactionCount(category.id, category.name);
                const adjustment = getCategoryAdjustment(category.name);
              
                return (
                  <div
                    key={category.id}
                    className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    {/* Left side: Color dot, name, stats */}
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      {/* Color indicator */}
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: category.color }}
                      />
                    
                      {/* Category info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                            {category.name}
                          </h4>
                          {/* Adjustment badge - calculates difference dynamically from current month limit */}
                          {adjustment && (() => {
                            const currentLimit = getCurrentMonthLimit(category.name, category.monthlyLimit);
                            const dynamicDiff = adjustment.new_limit - currentLimit;
                            const isIncrease = dynamicDiff > 0;
                            return (
                              <button
                                onClick={() => handleEditWithTab(category, 'adjustment')}
                                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${
                                  isIncrease
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                }`}
                                title={`Next month: ${formatCurrency(adjustment.new_limit)}`}
                              >
                                {isIncrease ? (
                                  <TrendingUp className="h-3 w-3" />
                                ) : (
                                  <TrendingDown className="h-3 w-3" />
                                )}
                                <span className="hidden sm:inline">
                                  {isIncrease ? '+' : '-'}
                                  {formatCurrency(Math.abs(dynamicDiff))}
                                </span>
                              </button>
                            );
                          })()}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                          {/* Monthly limit - shows current month's value (includes mid-month edits) */}
                          <span>
                            {formatCurrency(getCurrentMonthLimit(category.name, category.monthlyLimit))}
                            <span className="hidden md:inline"> / month</span>
                          </span>
                          {/* Transaction count - icon only on small, with label on medium+ */}
                          <span className="flex items-center gap-1" title={`${transactionCount} transaction${transactionCount !== 1 ? 's' : ''}`}>
                            <Receipt className="h-3.5 w-3.5" />
                            <span>{transactionCount}</span>
                            <span className="hidden md:inline">txn{transactionCount !== 1 ? 's' : ''}</span>
                          </span>
                          {/* Warning threshold - icon only on small, with label on medium+ */}
                          {category.warningThreshold < 100 && (
                            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400" title={`Alert at ${category.warningThreshold}%`}>
                              <AlertCircle className="h-3.5 w-3.5" />
                              <span className="hidden md:inline">Alert at </span>
                              {category.warningThreshold}%
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right side: Edit link */}
                    <button
                      onClick={() => handleEditWithTab(category, 'edit')}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                    >
                      <Edit3 className="h-4 w-4" />
                      Edit
                    </button>
                  </div>
                );
              } else if (item.type === 'future' && item.adjustment) {
                // Future category (scheduled for next month)
                const adj = item.adjustment;
                return (
                  <div
                    key={adj.id}
                    className="flex items-center justify-between p-4 bg-orange-50/50 dark:bg-orange-900/10 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
                  >
                    {/* Left side */}
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      {/* Future indicator instead of color */}
                      <div className="w-4 h-4 rounded-full flex-shrink-0 bg-orange-200 dark:bg-orange-800 flex items-center justify-center">
                        <Calendar className="h-2.5 w-2.5 text-orange-600 dark:text-orange-400" />
                      </div>
                    
                      {/* Category info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                            {adj.category_name}
                          </h4>
                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                            <Sparkles className="h-3 w-3" />
                            <span className="hidden sm:inline">Next month</span>
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                          <span>
                            {formatCurrency(adj.new_limit)}
                            <span className="hidden md:inline"> / month</span>
                          </span>
                          <span className="text-orange-600 dark:text-orange-400 text-xs">
                            Starts {nextMonthSummary?.effectiveDate}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right side: Cancel button */}
                    <button
                      onClick={() => handleCancelAdjustment(adj.id)}
                      disabled={cancelAdjustment.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      <X className="h-4 w-4" />
                      Cancel
                    </button>
                  </div>
                );
              }
              return null;
            })}
          </div>
        </div>
      )}

      {/* Adjustments Summary - Only show if there are adjustments to existing categories */}
      {dynamicSummary.adjustmentCount > 0 && (
        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-200 dark:border-orange-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-orange-200 dark:border-orange-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                <h3 className="font-semibold text-orange-800 dark:text-orange-200">
                  Next month summary
                </h3>
              </div>
              <span className="text-sm text-orange-600 dark:text-orange-400">
                {dynamicSummary.effectiveDate}
              </span>
            </div>
          </div>
          
          {/* Summary stats - calculated dynamically from current month limits */}
          <div className="px-4 py-3 grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-orange-600 dark:text-orange-400 uppercase">Changes</p>
              <p className="text-lg font-semibold text-orange-800 dark:text-orange-200">{dynamicSummary.adjustmentCount}</p>
            </div>
            <div>
              <p className="text-xs text-green-600 dark:text-green-400 uppercase">Increases</p>
              <p className="text-lg font-semibold text-green-600 dark:text-green-400">+{formatCurrency(dynamicSummary.totalIncrease)}</p>
            </div>
            <div>
              <p className="text-xs text-red-600 dark:text-red-400 uppercase">Decreases</p>
              <p className="text-lg font-semibold text-red-600 dark:text-red-400">-{formatCurrency(dynamicSummary.totalDecrease)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <AddCategoryModal 
        isOpen={showAddModal} 
        onClose={() => setShowAddModal(false)} 
      />
      
      <CategoryEditModal
        isOpen={!!editCategory}
        category={editCategory}
        onClose={() => {
          setEditCategory(null);
          setEditInitialTab('edit');
        }}
        initialTab={editInitialTab}
      />
    </div>
  );
};
