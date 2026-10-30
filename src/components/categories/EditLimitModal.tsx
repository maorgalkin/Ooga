// Edit Limit Modal
// Part of Category Management Restructure (Phase 4)

import React, { useState, useEffect } from 'react';
import { X, DollarSign, AlertTriangle } from 'lucide-react';
import { useUpdateCategory } from '../../hooks/useCategories';
import type { Category } from '../../types/category';

interface EditLimitModalProps {
  isOpen: boolean;
  category: Category | null;
  onClose: () => void;
}

export const EditLimitModal: React.FC<EditLimitModalProps> = ({
  isOpen,
  category,
  onClose,
}) => {
  const [monthlyLimit, setMonthlyLimit] = useState('');
  const [warningThreshold, setWarningThreshold] = useState('80');
  
  const updateCategory = useUpdateCategory();

  // Reset form when category changes
  useEffect(() => {
    if (category) {
      setMonthlyLimit(category.monthlyLimit.toString());
      setWarningThreshold(category.warningThreshold.toString());
    }
  }, [category]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!category) return;
    
    const limit = parseFloat(monthlyLimit) || 0;
    const threshold = parseInt(warningThreshold) || 80;

    try {
      await updateCategory.mutateAsync({
        categoryId: category.id,
        input: {
          monthlyLimit: limit,
          warningThreshold: Math.min(100, Math.max(0, threshold)),
        },
      });
      onClose();
    } catch (error) {
      console.error('Failed to update category limit:', error);
    }
  };

  const handleClose = () => {
    if (!updateCategory.isPending) {
      onClose();
    }
  };

  if (!isOpen || !category) return null;

  const limitChanged = parseFloat(monthlyLimit) !== category.monthlyLimit;
  const thresholdChanged = parseInt(warningThreshold) !== category.warningThreshold;
  const hasChanges = limitChanged || thresholdChanged;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div 
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: category.color }}
            />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Edit limit: {category.name}
            </h2>
          </div>
          <button
            onClick={handleClose}
            disabled={updateCategory.isPending}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Monthly Limit */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Monthly limit
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none">
                <DollarSign className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="number"
                value={monthlyLimit}
                onChange={(e) => setMonthlyLimit(e.target.value)}
                placeholder="0"
                min="0"
                step="0.01"
                className="w-full ps-9 pe-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Set to 0 for unlimited spending
            </p>
          </div>

          {/* Warning Threshold */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Warning threshold
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none">
                <AlertTriangle className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="number"
                value={warningThreshold}
                onChange={(e) => setWarningThreshold(e.target.value)}
                placeholder="80"
                min="0"
                max="100"
                className="w-full ps-9 pe-12 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <div className="absolute inset-y-0 end-0 flex items-center pe-3 pointer-events-none">
                <span className="text-gray-400">%</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Show warning when spending reaches this percentage of the limit
            </p>
          </div>

          {/* Preview */}
          {hasChanges && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
              <h4 className="text-sm font-medium text-green-800 dark:text-green-200 mb-1">
                Preview
              </h4>
              <ul className="text-sm text-green-700 dark:text-green-300 space-y-1">
                {limitChanged && (
                  <li>
                    Limit: ₪{category.monthlyLimit} → ₪{parseFloat(monthlyLimit) || 0}
                  </li>
                )}
                {thresholdChanged && (
                  <li>
                    Warning: {category.warningThreshold}% → {parseInt(warningThreshold) || 80}%
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Error */}
          {updateCategory.isError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-600 dark:text-red-400">
                Failed to update category. Please try again.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={updateCategory.isPending}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateCategory.isPending || !hasChanges}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {updateCategory.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Saving...
                </>
              ) : (
                'Save changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
