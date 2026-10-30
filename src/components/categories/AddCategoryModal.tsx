// Add Category Modal
// Part of Category Management Restructure (Phase 4)
// Updated: Single form with schedule toggle

import React, { useState, useEffect } from 'react';
import { errorMessage } from '../../i18n/errors';
import { useT } from '../../hooks/useT';
import { X, AlertCircle, HelpCircle } from 'lucide-react';
import { useCreateCategory, useCategories } from '../../hooks/useCategories';
import { useScheduleAdjustment, useNextMonthAdjustments } from '../../hooks/useBudgets';
import { getNextCategoryColor } from '../../types/category';

interface AddCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddCategoryModal: React.FC<AddCategoryModalProps> = ({ isOpen, onClose }) => {
  const t = useT();
  const { data: existingCategories } = useCategories();
  const { data: nextMonthSummary } = useNextMonthAdjustments();
  const createCategory = useCreateCategory();
  const scheduleAdjustment = useScheduleAdjustment();
  
  const [scheduleForNextMonth, setScheduleForNextMonth] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3B82F6');
  const [monthlyLimit, setMonthlyLimit] = useState('');
  const [warningThreshold, setWarningThreshold] = useState('80');
  const [error, setError] = useState('');

  // Check if name already exists in pending adjustments
  const nameExistsInAdjustments = (categoryName: string): boolean => {
    if (!nextMonthSummary) return false;
    return nextMonthSummary.adjustments.some(
      adj => adj.category_name.toLowerCase() === categoryName.toLowerCase()
    );
  };

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setScheduleForNextMonth(false);
      setName('');
      setMonthlyLimit('');
      setWarningThreshold('80');
      setError('');
      
      // Set next available color
      const existingColors = existingCategories?.map(c => c.color.toLowerCase()) || [];
      setColor(getNextCategoryColor(existingColors));
    }
  }, [isOpen, existingCategories]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!name.trim()) {
      setError(t('categories.edit.errors.nameRequired'));
      return;
    }

    // Check for duplicate name in existing categories
    const isDuplicate = existingCategories?.some(
      c => c.name.toLowerCase() === name.trim().toLowerCase()
    );
    if (isDuplicate) {
      setError(t('categories.edit.errors.duplicate'));
      return;
    }

    // Check for duplicate in pending adjustments (for scheduled mode)
    if (scheduleForNextMonth && nameExistsInAdjustments(name.trim())) {
      setError(t('categories.add.errors.alreadyScheduled'));
      return;
    }

    try {
      if (!scheduleForNextMonth) {
        // Create category immediately
        await createCategory.mutateAsync({
          name: name.trim(),
          color,
          monthlyLimit: parseFloat(monthlyLimit) || 0,
          warningThreshold: parseInt(warningThreshold) || 80,
        });
      } else {
        // Schedule as adjustment for next month
        await scheduleAdjustment.mutateAsync({
          categoryName: name.trim(),
          currentLimit: 0,
          newLimit: parseFloat(monthlyLimit) || 0,
          reason: 'New category scheduled for next month',
        });
      }
      onClose();
    } catch (err) {
      setError(errorMessage(err, t, 'categories.add.errors.createFailed'));
    }
  };

  const isPending = createCategory.isPending || scheduleAdjustment.isPending;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t('categories.list.add')}
          </h2>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('categories.add.name')}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('categories.add.namePlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              autoFocus
            />
          </div>

          {/* Color & Monthly Limit - Inline */}
          <div className="flex gap-3">
            {/* Native Color Picker */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('categories.edit.color')}
              </label>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="color-picker-full w-10 h-10 rounded-lg border border-gray-300 dark:border-gray-600 cursor-pointer"
              />
            </div>

            {/* Monthly Limit */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('categories.edit.monthlyLimit')}
              </label>
              <div className="relative">
                <span className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-500">₪</span>
                <input
                  type="number"
                  value={monthlyLimit}
                  onChange={(e) => setMonthlyLimit(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="50"
                  className="w-full ps-8 pe-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Warning Threshold */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('categories.edit.warningAt')}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                value={warningThreshold}
                onChange={(e) => setWarningThreshold(e.target.value)}
                min="50"
                max="100"
                step="5"
                className="flex-1"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400 w-12 text-end">
                {warningThreshold}%
              </span>
            </div>
          </div>

          {/* Schedule Toggle */}
          <div className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('categories.add.schedule')}
              </span>
              <div className="relative group">
                <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none w-48 z-10">
                  {t('categories.add.scheduleHint')}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setScheduleForNextMonth(!scheduleForNextMonth)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                scheduleForNextMonth ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  scheduleForNextMonth ? 'translate-x-6 rtl:-translate-x-6' : 'translate-x-1 rtl:-translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className={`px-4 py-2 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                scheduleForNextMonth
                  ? 'bg-orange-500 hover:bg-orange-600'
                  : 'bg-purple-600 hover:bg-purple-700'
              }`}
            >
              {isPending
                ? t(scheduleForNextMonth ? 'categories.add.scheduling' : 'categories.add.creating')
                : t(scheduleForNextMonth ? 'categories.add.schedule' : 'categories.add.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
