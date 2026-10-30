import React, { useState } from 'react';
import { 
  useNextMonthAdjustments, 
  useScheduleAdjustment, 
  useCancelAdjustment,
  useActiveBudget,
  useUpdatePersonalBudget
} from '../hooks/useBudgets';
import { Calendar, TrendingUp, TrendingDown, X, Plus, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { getNextAvailableColor, CATEGORY_COLOR_PALETTE } from '../utils/categoryColors';
import {
  getPrimaryButtonBg,
  getPrimaryButtonHoverBg,
  getInactiveBg,
  getInactiveBorderColor,
} from '../utils/themeColors';

interface BudgetAdjustmentSchedulerProps {
  className?: string;
}

export const BudgetAdjustmentScheduler: React.FC<BudgetAdjustmentSchedulerProps> = ({
  className = '',
}) => {
  const [isScheduling, setIsScheduling] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [newLimit, setNewLimit] = useState('');
  const [reason, setReason] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#3B82F6'); // Default blue

  const themeColor = 'green';
  
  const { data: nextMonthSummary, isLoading } = useNextMonthAdjustments();
  const { data: activeBudget } = useActiveBudget();
  const scheduleAdjustment = useScheduleAdjustment();
  const cancelAdjustment = useCancelAdjustment();
  const updatePersonalBudget = useUpdatePersonalBudget();

  const formatCurrency = (amount: number): string => {
    const currency = activeBudget?.global_settings?.currency || 'USD';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const handleSchedule = async () => {
    if (!activeBudget) return;

    // Validate based on mode
    if (isCreatingNew) {
      // Creating a new category
      if (!newCategoryName.trim()) {
        alert('Please enter a category name');
        return;
      }
      if (newLimit === '') {
        alert('Please enter a budget limit');
        return;
      }
      // Check if category already exists
      if (allPersonalCategories[newCategoryName.trim()]) {
        alert('A category with this name already exists. Please choose a different name.');
        return;
      }
    } else {
      // Adjusting existing category
      if (!selectedCategory || newLimit === '') return;
    }

    const newLimitNum = parseFloat(newLimit);

    // Allow 0 (deactivation) but reject negative numbers
    if (isNaN(newLimitNum) || newLimitNum < 0) {
      alert('Please enter a valid amount (0 or greater)');
      return;
    }

    try {
      if (isCreatingNew) {
        // Schedule an adjustment for next month with new category metadata
        // Category will be added to personal budget when adjustment is applied on 1st
        const categoryName = newCategoryName.trim();
        
        // Store category metadata in the reason field as JSON
        const categoryMetadata = {
          color: newCategoryColor,
          warningThreshold: 80,
          description: '',
          isActive: true,
        };
        
        const adjustmentReason = reason 
          ? `${reason} | __META__:${JSON.stringify(categoryMetadata)}`
          : `New category: ${categoryName} | __META__:${JSON.stringify(categoryMetadata)}`;

        await scheduleAdjustment.mutateAsync({
          categoryName: categoryName,
          currentLimit: 0,
          newLimit: newLimitNum,
          reason: adjustmentReason,
        });

        // Reset new category form
        setNewCategoryName('');
        setNewCategoryColor(getNextAvailableColor(
          Object.values(activeBudget.categories)
            .map(c => c.color)
            .filter((color): color is string => color !== undefined)
        ));
      } else {
        // Schedule adjustment for existing category
        const currentLimit = activeBudget.categories[selectedCategory]?.monthlyLimit || 0;

        await scheduleAdjustment.mutateAsync({
          categoryName: selectedCategory,
          currentLimit,
          newLimit: newLimitNum,
          reason: reason || undefined,
        });

        // Reset existing category form
        setSelectedCategory('');
      }

      // Reset common fields
      setNewLimit('');
      setReason('');
      setIsScheduling(false);
      setIsCreatingNew(false);
    } catch (error) {
      console.error('Error scheduling adjustment:', error);
      alert(`Failed to ${isCreatingNew ? 'create category' : 'schedule adjustment'}`);
    }
  };

  const handleCancel = async (adjustmentId: string) => {
    if (!confirm('Are you sure you want to cancel this adjustment?')) return;

    try {
      await cancelAdjustment.mutateAsync(adjustmentId);
    } catch (error) {
      console.error('Error cancelling adjustment:', error);
      alert('Failed to cancel adjustment');
    }
  };

  // Get all categories from personal budget (including inactive ones)
  const allPersonalCategories = activeBudget?.categories || {};
  
  // Show all categories (active and inactive) - users can add new ones or adjust existing
  const availableCategories = Object.keys(allPersonalCategories);

  if (isLoading) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          <span className="ms-3 text-gray-600 dark:text-gray-300">Loading adjustments...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md ${className}`}>
      {/* Header */}
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {nextMonthSummary && (
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 flex items-center">
              <Calendar className="inline h-4 w-4 me-1 flex-shrink-0" />
              <span>{nextMonthSummary.effectiveDate}</span>
            </p>
          )}
          <button
            onClick={() => setIsScheduling(!isScheduling)}
            className={`flex items-center justify-center px-4 py-2 ${getPrimaryButtonBg(themeColor)} text-white rounded-md ${getPrimaryButtonHoverBg(themeColor)} transition-colors text-sm font-medium whitespace-nowrap`}
          >
            {isScheduling ? (
              <>
                <X className="h-4 w-4 me-2 flex-shrink-0" />
                <span>Cancel</span>
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 me-2 flex-shrink-0" />
                <span>Schedule</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      {nextMonthSummary && nextMonthSummary.adjustmentCount > 0 && (
        <div className="px-4 sm:px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Adjustments</p>
              <p className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 mt-1">
                {nextMonthSummary.adjustmentCount}
              </p>
            </div>
            <div>
              <p className="text-xs text-green-600 dark:text-green-400 uppercase">Increases</p>
              <p className="text-lg sm:text-xl font-semibold text-green-600 dark:text-green-400 mt-1">
                +{formatCurrency(nextMonthSummary.totalIncrease)}
              </p>
            </div>
            <div>
              <p className="text-xs text-red-600 dark:text-red-400 uppercase">Decreases</p>
              <p className="text-lg sm:text-xl font-semibold text-red-600 dark:text-red-400 mt-1">
                -{formatCurrency(nextMonthSummary.totalDecrease)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Net Change</p>
              <p className={`text-lg sm:text-xl font-semibold mt-1 ${
                nextMonthSummary.netChange > 0 
                  ? 'text-green-600 dark:text-green-400' 
                  : nextMonthSummary.netChange < 0 
                    ? 'text-red-600 dark:text-red-400' 
                    : 'text-gray-600 dark:text-gray-400'
              }`}>
                {nextMonthSummary.netChange > 0 && '+'}
                {formatCurrency(nextMonthSummary.netChange)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Scheduling Form */}
      {isScheduling && (
        <div className={`px-4 sm:px-6 py-4 ${getInactiveBg(themeColor)} border-b ${getInactiveBorderColor(themeColor)}`}>
          <div className="space-y-4">
            {/* Toggle between existing and new category */}
            <div className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 pb-3 border-b ${getInactiveBorderColor(themeColor)}`}>
              <button
                onClick={() => setIsCreatingNew(false)}
                className={`px-4 py-2 rounded-md font-medium transition-colors text-sm ${
                  !isCreatingNew
                    ? `${getPrimaryButtonBg(themeColor)} text-white`
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                }`}
              >
                Existing Category
              </button>
              <button
                onClick={() => setIsCreatingNew(true)}
                className={`flex items-center justify-center gap-2 px-4 py-2 rounded-md font-medium transition-colors text-sm ${
                  isCreatingNew
                    ? `${getPrimaryButtonBg(themeColor)} text-white`
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                }`}
              >
                <Sparkles className="h-4 w-4 flex-shrink-0" />
                <span>New Category</span>
              </button>
            </div>

            {isCreatingNew ? (
              <>
                {/* New Category Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Category Name
                  </label>
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="e.g., Holiday Shopping, Vacation..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>

                {/* Color Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Color
                  </label>
                  <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                    {CATEGORY_COLOR_PALETTE.map((color) => (
                      <button
                        key={color}
                        onClick={() => setNewCategoryColor(color)}
                        className={`w-8 h-8 rounded-md transition-all ${
                          newCategoryColor === color
                            ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-gray-800 scale-110'
                            : 'hover:scale-105'
                        }`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Existing Category Dropdown */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Category
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">Select a category...</option>
                    {availableCategories.map((cat) => {
                      const categoryConfig = allPersonalCategories[cat];
                      const currentLimit = categoryConfig.monthlyLimit || 0;
                      const isActive = categoryConfig.isActive;
                      
                      return (
                        <option key={cat} value={cat}>
                          {cat} - Current: {formatCurrency(currentLimit)} {!isActive ? '(Inactive)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                New Limit
              </label>
              <input
                type="number"
                value={newLimit}
                onChange={(e) => setNewLimit(e.target.value)}
                placeholder="Enter new limit (0 to deactivate)..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                min="0"
                step="0.01"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Set to 0 to deactivate category for next month
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Reason (Optional)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why are you adjusting this category?"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                rows={2}
              />
            </div>

            <button
              onClick={handleSchedule}
              disabled={
                (isCreatingNew ? (!newCategoryName.trim() || newLimit === '') : (!selectedCategory || newLimit === '')) ||
                scheduleAdjustment.isPending ||
                updatePersonalBudget.isPending
              }
              className={`w-full px-4 py-2 ${getPrimaryButtonBg(themeColor)} text-white rounded-md ${getPrimaryButtonHoverBg(themeColor)} disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium`}
            >
              {scheduleAdjustment.isPending || updatePersonalBudget.isPending 
                ? (isCreatingNew ? 'Creating...' : 'Scheduling...') 
                : (isCreatingNew ? 'Create Category' : 'Schedule Adjustment')}
            </button>
          </div>
        </div>
      )}

      {/* Pending Adjustments List */}
      <div className="px-4 sm:px-6 py-4">
        {!nextMonthSummary || nextMonthSummary.adjustmentCount === 0 ? (
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-gray-400">No adjustments scheduled for next month</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
              Click "Schedule" to create your first adjustment
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {nextMonthSummary.adjustments.map((adjustment) => (
              <div
                key={adjustment.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-3 px-4 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-start sm:items-center space-x-3 rtl:space-x-reverse flex-1 min-w-0">
                  <div className="flex-shrink-0 mt-0.5 sm:mt-0">
                    {adjustment.adjustment_type === 'increase' ? (
                      <TrendingUp className="h-5 w-5 text-green-500" />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-gray-100 break-words">
                      {adjustment.category_name}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
                      <span>{formatCurrency(adjustment.current_limit)}</span>
                      <span>→</span>
                      <span className="font-medium">{formatCurrency(adjustment.new_limit)}</span>
                      <span className={`${
                        adjustment.adjustment_type === 'increase' 
                          ? 'text-green-600 dark:text-green-400' 
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        ({adjustment.adjustment_type === 'increase' ? '+' : '-'}
                        {formatCurrency(adjustment.adjustment_amount)})
                      </span>
                    </div>
                    {adjustment.reason && (
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 italic break-words">
                        "{adjustment.reason.split(' | __META__:')[0]}"
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleCancel(adjustment.id)}
                  disabled={cancelAdjustment.isPending}
                  className="self-end sm:self-auto flex-shrink-0 p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                  title="Cancel adjustment"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
