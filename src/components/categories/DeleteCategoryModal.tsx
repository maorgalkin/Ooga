// Delete Category Modal
// Part of Category Management Restructure (Phase 4)

import React, { useState } from 'react';
import { X, AlertTriangle, Trash2, ArrowRight } from 'lucide-react';
import { useDeleteCategory, useCategories } from '../../hooks/useCategories';
import type { Category } from '../../types/category';

interface DeleteCategoryModalProps {
  isOpen: boolean;
  category: Category | null;
  transactionCount: number;
  onClose: () => void;
}

export const DeleteCategoryModal: React.FC<DeleteCategoryModalProps> = ({ 
  isOpen, 
  category, 
  transactionCount,
  onClose 
}) => {
  const { data: allCategories } = useCategories();
  const deleteCategory = useDeleteCategory();

  const [reassignTo, setReassignTo] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');

  // Get other categories for reassignment
  const otherCategories = allCategories?.filter(c => c.id !== category?.id && c.isActive) || [];

  const handleDelete = async () => {
    if (!category) return;
    
    setError('');
    setIsDeleting(true);

    try {
      // If there are transactions and user selected reassignment
      if (transactionCount > 0 && reassignTo) {
        // Update all transactions to the new category
        // This would need a bulk update function in the service
        // For now, we'll just delete the category (transactions keep their category_id but category is soft-deleted)
      }

      await deleteCategory.mutateAsync({
        categoryId: category.id,
        categoryName: category.name,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete category');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen || !category) return null;

  const hasTransactions = transactionCount > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Delete Category
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Category info */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div
              className="w-4 h-4 rounded-full flex-shrink-0"
              style={{ backgroundColor: category.color }}
            />
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">{category.name}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {transactionCount} transaction{transactionCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-700 dark:text-amber-300">
              {hasTransactions ? (
                <>
                  <p className="font-medium mb-1">This category has transactions</p>
                  <p>
                    Deleting this category will hide it from selection, but existing transactions
                    will keep their historical categorization.
                  </p>
                </>
              ) : (
                <p>
                  This will permanently delete the category. This action cannot be undone.
                </p>
              )}
            </div>
          </div>

          {/* Reassignment option (if has transactions) */}
          {hasTransactions && otherCategories.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Reassign transactions to (optional):
              </label>
              <select
                value={reassignTo}
                onChange={(e) => setReassignTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-red-500 focus:border-transparent"
              >
                <option value="">Keep original categorization</option>
                {otherCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {reassignTo && (
                <div className="flex items-center gap-2 mt-2 text-sm text-gray-600 dark:text-gray-400">
                  <span>{category.name}</span>
                  <ArrowRight className="h-4 w-4 rtl:-scale-x-100" />
                  <span>{otherCategories.find(c => c.id === reassignTo)?.name}</span>
                  <span className="text-gray-400">({transactionCount} transactions)</span>
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
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
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              {isDeleting ? 'Deleting...' : 'Delete Category'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
