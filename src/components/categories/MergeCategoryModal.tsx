// Merge Category Modal
// Part of Category Management Restructure (Phase 4)

import React, { useState, useMemo } from 'react';
import { X, AlertCircle, GitMerge, ArrowRight, Check, Info } from 'lucide-react';
import { useMergeCategories } from '../../hooks/useCategories';
import { useFinance } from '../../context/FinanceContext';
import type { Category } from '../../types/category';

interface MergeCategoryModalProps {
  isOpen: boolean;
  sourceCategory: Category | null;
  allCategories: Category[];
  onClose: () => void;
}

export const MergeCategoryModal: React.FC<MergeCategoryModalProps> = ({ 
  isOpen, 
  sourceCategory,
  allCategories,
  onClose 
}) => {
  const { transactions } = useFinance();
  const mergeCategories = useMergeCategories();
  
  const [targetCategoryId, setTargetCategoryId] = useState<string>('');
  const [error, setError] = useState('');

  // Filter out the source category from targets
  const targetOptions = allCategories.filter(c => c.id !== sourceCategory?.id);

  // Calculate transaction counts
  const sourceTransactionCount = useMemo(() => {
    if (!sourceCategory) return 0;
    return transactions.filter(t => t.category_id === sourceCategory.id).length;
  }, [transactions, sourceCategory]);

  const targetCategory = targetOptions.find(c => c.id === targetCategoryId);
  
  const targetTransactionCount = useMemo(() => {
    if (!targetCategoryId) return 0;
    return transactions.filter(t => t.category_id === targetCategoryId).length;
  }, [transactions, targetCategoryId]);

  // Calculate combined budget
  const combinedBudget = useMemo(() => {
    if (!sourceCategory || !targetCategory) return 0;
    return sourceCategory.monthlyLimit + targetCategory.monthlyLimit;
  }, [sourceCategory, targetCategory]);

  const handleMerge = async () => {
    if (!sourceCategory || !targetCategoryId) return;
    
    setError('');

    try {
      await mergeCategories.mutateAsync({
        sourceCategoryId: sourceCategory.id,
        targetCategoryId,
        reason: `Merged ${sourceCategory.name} into ${targetCategory?.name}`,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to merge categories');
    }
  };

  // Reset state when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setTargetCategoryId('');
      setError('');
    }
  }, [isOpen]);

  if (!isOpen || !sourceCategory) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <GitMerge className="h-5 w-5 text-green-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Merge Category
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Source category */}
          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
              Merge from:
            </label>
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div
                className="w-4 h-4 rounded-full flex-shrink-0"
                style={{ backgroundColor: sourceCategory.color }}
              />
              <div className="flex-1">
                <p className="font-medium text-gray-900 dark:text-gray-100">{sourceCategory.name}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  ₪{sourceCategory.monthlyLimit.toLocaleString()} budget • {sourceTransactionCount} transactions
                </p>
              </div>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <ArrowRight className="h-6 w-6 text-gray-400 rotate-90" />
          </div>

          {/* Target category selector */}
          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
              Merge into:
            </label>
            <select
              value={targetCategoryId}
              onChange={(e) => setTargetCategoryId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">Select a category...</option>
              {targetOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} (₪{c.monthlyLimit.toLocaleString()})
                </option>
              ))}
            </select>
          </div>

          {/* Preview */}
          {targetCategory && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: targetCategory.color }}
                />
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-gray-100">{targetCategory.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    ₪{targetCategory.monthlyLimit.toLocaleString()} budget • {targetTransactionCount} transactions
                  </p>
                </div>
              </div>

              {/* Merge preview */}
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-medium">
                  <Info className="h-4 w-4" />
                  After merge:
                </div>
                <ul className="text-sm text-blue-600 dark:text-blue-400 space-y-1 ms-6">
                  <li className="flex items-center gap-2">
                    <Check className="h-3 w-3" />
                    New budget: ₪{combinedBudget.toLocaleString()} / month
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3 w-3" />
                    {sourceTransactionCount + targetTransactionCount} total transactions
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3 w-3" />
                    "{sourceCategory.name}" will be archived
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* Info box */}
          <div className="flex items-start gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400 rounded-lg text-sm">
            <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <p>
              Merging combines two categories into one. All transactions from 
              "{sourceCategory.name}" will be moved to the target category. 
              This action can be undone from the merge history.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleMerge}
              disabled={mergeCategories.isPending || !targetCategoryId}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <GitMerge className="h-4 w-4" />
              {mergeCategories.isPending ? 'Merging...' : 'Merge Categories'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
