// Rename Category Modal
// Part of Category Management Restructure (Phase 4)

import React, { useState, useEffect } from 'react';
import { useT } from '../../hooks/useT';
import { X, AlertCircle, Check } from 'lucide-react';
import { useRenameCategory, useCategories } from '../../hooks/useCategories';
import { useFinance } from '../../context/FinanceContext';
import type { Category } from '../../types/category';

interface RenameCategoryModalProps {
  isOpen: boolean;
  category: Category | null;
  onClose: () => void;
}

export const RenameCategoryModal: React.FC<RenameCategoryModalProps> = ({ 
  isOpen, 
  category, 
  onClose 
}) => {
  const t = useT();
  const { data: existingCategories } = useCategories();
  const renameCategory = useRenameCategory();
  const { refreshTransactions } = useFinance();
  
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen && category) {
      setNewName(category.name);
      setError('');
    }
  }, [isOpen, category]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!category) return;

    // Validation
    if (!newName.trim()) {
      setError(t('categories.edit.errors.nameRequired'));
      return;
    }

    if (newName.trim() === category.name) {
      onClose();
      return;
    }

    // Check for duplicate name
    const isDuplicate = existingCategories?.some(
      c => c.id !== category.id && c.name.toLowerCase() === newName.trim().toLowerCase()
    );
    if (isDuplicate) {
      setError(t('categories.edit.errors.duplicate'));
      return;
    }

    try {
      await renameCategory.mutateAsync({
        categoryId: category.id,
        newName: newName.trim(),
        oldName: category.name,
      });
      // Refresh transactions to update category names in UI
      await refreshTransactions();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('categories.rename.failed'));
    }
  };

  if (!isOpen || !category) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t('categories.rename.title')}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          aria-label={t('common.close')}
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Current name display */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div
              className="w-4 h-4 rounded-full flex-shrink-0"
              style={{ backgroundColor: category.color }}
            />
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">{t('categories.rename.currentName')}</span>
              <p className="font-medium text-gray-900 dark:text-gray-100">{category.name}</p>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* New name input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('categories.rename.newName')}
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t('categories.rename.newNamePlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              autoFocus
            />
          </div>

          {/* Info box */}
          <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg text-sm">
            <Check className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <p>
              {t('categories.rename.info')}
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={renameCategory.isPending || newName.trim() === category.name}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {renameCategory.isPending ? t('categories.rename.renaming') : t('categories.rename.confirm')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
