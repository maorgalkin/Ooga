// Unified Category Edit Modal
// Combines editing, renaming, merging, adjustments, and deleting capabilities
// Updated: Fixed size modal, compact color picker

import React, { useState, useEffect, useMemo } from 'react';
import { errorMessage } from '../../i18n/errors';
import { Trans } from 'react-i18next';
import { useT } from '../../hooks/useT';
import { 
  X, 
  Edit3, 
  GitMerge, 
  Trash2, 
  AlertTriangle,
  Check,
  Info,
  ArrowRight,
  Sliders,
  HelpCircle
} from 'lucide-react';
import { 
  useUpdateCategory, 
  useRenameCategory, 
  useDeleteCategory,
  useMergeCategories,
  useCategories 
} from '../../hooks/useCategories';
import {
  useNextMonthAdjustments,
  useScheduleAdjustment,
  useCancelAdjustment,
  useActiveBudget,
  useCurrentMonthBudget,
  useUpdateCategoryLimit
} from '../../hooks/useBudgets';
import { useFinance } from '../../context/FinanceContext';
import type { Category } from '../../types/category';
import { formatCurrencyFromSettings } from '../../utils/formatCurrency';

type TabType = 'edit' | 'merge' | 'adjustment';

interface CategoryEditModalProps {
  isOpen: boolean;
  category: Category | null;
  onClose: () => void;
  initialTab?: TabType;
}

export const CategoryEditModal: React.FC<CategoryEditModalProps> = ({
  isOpen,
  category,
  onClose,
  initialTab = 'edit',
}) => {
  const t = useT();
  const { data: allCategories } = useCategories(false, 'expense');
  const { transactions, refreshTransactions } = useFinance();
  const { data: nextMonthSummary } = useNextMonthAdjustments();
  const { data: activeBudget } = useActiveBudget();
  
  const { data: currentMonthBudget } = useCurrentMonthBudget();
  
  const updateCategory = useUpdateCategory();
  const renameCategory = useRenameCategory();
  const deleteCategory = useDeleteCategory();
  const mergeCategories = useMergeCategories();
  const scheduleAdjustment = useScheduleAdjustment();
  const cancelAdjustment = useCancelAdjustment();
  const updateCategoryLimit = useUpdateCategoryLimit();
  
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Edit tab state
  const [monthlyLimit, setMonthlyLimit] = useState('');
  const [warningThreshold, setWarningThreshold] = useState('80');
  const [color, setColor] = useState('#3B82F6');
  
  // Rename tab state
  const [newName, setNewName] = useState('');
  
  // Merge tab state
  const [targetCategoryId, setTargetCategoryId] = useState('');
  
  // Adjustment tab state
  const [nextMonthLimit, setNextMonthLimit] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');

  // Calculate transaction count
  const transactionCount = useMemo(() => {
    if (!category) return 0;
    return transactions.filter(tx => tx.category_id === category.id).length;
  }, [transactions, category]);

  // Get other categories for merge/reassign
  const otherCategories = useMemo(() => {
    return allCategories?.filter(c => c.id !== category?.id && c.isActive) || [];
  }, [allCategories, category]);

  // Target category for merge
  const targetCategory = otherCategories.find(c => c.id === targetCategoryId);

  // Target transaction count for merge preview
  const targetTransactionCount = useMemo(() => {
    if (!targetCategoryId) return 0;
    return transactions.filter(tx => tx.category_id === targetCategoryId).length;
  }, [transactions, targetCategoryId]);

  // Combined budget for merge preview
  const combinedBudget = useMemo(() => {
    if (!category || !targetCategory) return 0;
    return category.monthlyLimit + targetCategory.monthlyLimit;
  }, [category, targetCategory]);

  // Get pending adjustment for this category
  const categoryAdjustment = useMemo(() => {
    if (!nextMonthSummary || !category) return null;
    return nextMonthSummary.adjustments.find(
      adj => adj.category_name === category.name
    );
  }, [nextMonthSummary, category]);

  // Format currency
  const formatCurrency = (amount: number): string => {
    return formatCurrencyFromSettings(amount, activeBudget?.global_settings);
  };

  // Reset form when category changes or modal opens
  useEffect(() => {
    if (isOpen && category) {
      setActiveTab(initialTab);
      setError('');
      setShowDeleteConfirm(false);
      
      // Edit tab - use current month's limit if available (reflects mid-month edits)
      const currentLimit = currentMonthBudget?.categories?.[category.name]?.monthlyLimit ?? category.monthlyLimit;
      setMonthlyLimit(currentLimit.toString());
      setWarningThreshold(category.warningThreshold.toString());
      setColor(category.color);
      
      // Rename tab
      setNewName(category.name);
      
      // Merge tab
      setTargetCategoryId('');
      
      // Adjustment tab - use current month's limit as the starting point
      // If there's already a pending adjustment, show that value instead
      const currentLimitForAdjustment = currentMonthBudget?.categories?.[category.name]?.monthlyLimit ?? category.monthlyLimit;
      setNextMonthLimit(categoryAdjustment?.new_limit.toString() || currentLimitForAdjustment.toString());
      setAdjustmentReason('');
    }
  }, [isOpen, category, initialTab, categoryAdjustment, currentMonthBudget]);

  const isPending = updateCategory.isPending || renameCategory.isPending || 
                    deleteCategory.isPending || mergeCategories.isPending ||
                    scheduleAdjustment.isPending || cancelAdjustment.isPending ||
                    updateCategoryLimit.isPending;

  // Get current month's limit for comparison
  const currentMonthLimit = category 
    ? (currentMonthBudget?.categories?.[category.name]?.monthlyLimit ?? category.monthlyLimit)
    : 0;

  // Check if edit form has changes
  const editHasChanges = category && (
    parseFloat(monthlyLimit) !== currentMonthLimit ||
    parseInt(warningThreshold) !== category.warningThreshold ||
    color !== category.color ||
    newName.trim() !== category.name
  );

  const handleSaveEdit = async () => {
    if (!category) return;
    setError('');

    // Validate name
    if (!newName.trim()) {
      setError(t('categories.edit.errors.nameRequired'));
      return;
    }

    // Check for duplicate name (if name changed)
    const isRenamed = newName.trim() !== category.name;
    if (isRenamed) {
      const isDuplicate = allCategories?.some(
        c => c.id !== category.id && c.name.toLowerCase() === newName.trim().toLowerCase()
      );
      if (isDuplicate) {
        setError(t('categories.edit.errors.duplicate'));
        return;
      }
    }

    try {
      // First rename if needed (permanent - updates categories table AND monthly budgets)
      if (isRenamed) {
        await renameCategory.mutateAsync({
          categoryId: category.id,
          newName: newName.trim(),
          oldName: category.name,
        });
        // Refresh transactions to update category names in UI
        await refreshTransactions();
      }
      
      // Update color and warningThreshold permanently (these are category properties)
      // Use the NEW name if we renamed the category
      const categoryNameForUpdate = isRenamed ? newName.trim() : category.name;
      if (parseInt(warningThreshold) !== category.warningThreshold ||
          color !== category.color) {
        await updateCategory.mutateAsync({
          categoryId: category.id,
          input: {
            warningThreshold: Math.min(100, Math.max(0, parseInt(warningThreshold) || 80)),
            color,
            // NOTE: We do NOT update monthlyLimit here - that's handled separately via monthly budgets
          },
          categoryName: categoryNameForUpdate,
        });
      }
      
      // Update limit in current monthly budget (permanent for this month)
      // This does NOT change the personal budget template or categories table
      // Use the NEW name if we renamed the category
      const categoryNameForBudget = isRenamed ? newName.trim() : category.name;
      if (parseFloat(monthlyLimit) !== currentMonthLimit && currentMonthBudget) {
        await updateCategoryLimit.mutateAsync({
          monthlyBudgetId: currentMonthBudget.id,
          categoryName: categoryNameForBudget,
          newLimit: parseFloat(monthlyLimit) || 0,
          notes: 'Budget limit updated',
        });
      }
      
      onClose();
    } catch (err) {
      setError(errorMessage(err, t, 'categories.edit.errors.updateFailed'));
    }
  };

  const handleMerge = async () => {
    if (!category || !targetCategoryId) return;
    setError('');

    try {
      await mergeCategories.mutateAsync({
        sourceCategoryId: category.id,
        targetCategoryId,
        reason: `Merged ${category.name} into ${targetCategory?.name}`,
      });
      // Refresh transactions to update category names in UI
      await refreshTransactions();
      onClose();
    } catch (err) {
      setError(errorMessage(err, t, 'categories.edit.errors.mergeFailed'));
    }
  };

  const handleScheduleAdjustment = async () => {
    if (!category) return;
    setError('');

    const newLimitNum = parseFloat(nextMonthLimit);
    if (isNaN(newLimitNum) || newLimitNum < 0) {
      setError(t('categories.edit.errors.invalidAmount'));
      return;
    }

    // If there's already an adjustment, cancel it first
    if (categoryAdjustment) {
      try {
        await cancelAdjustment.mutateAsync(categoryAdjustment.id);
      } catch (err) {
        setError(errorMessage(err, t, 'categories.edit.errors.adjustmentUpdateFailed'));
        return;
      }
    }

    // Get current month's limit (includes mid-month edits)
    const currentLimitValue = currentMonthBudget?.categories?.[category.name]?.monthlyLimit ?? category.monthlyLimit;

    // If the new limit is the same as current, just cancel (already done above)
    if (newLimitNum === currentLimitValue) {
      onClose();
      return;
    }

    try {
      await scheduleAdjustment.mutateAsync({
        categoryName: category.name,
        currentLimit: currentLimitValue,
        newLimit: newLimitNum,
        reason: adjustmentReason || undefined,
      });
      onClose();
    } catch (err) {
      setError(errorMessage(err, t, 'categories.edit.errors.scheduleFailed'));
    }
  };

  const handleCancelAdjustment = async () => {
    if (!categoryAdjustment) return;
    setError('');

    try {
      await cancelAdjustment.mutateAsync(categoryAdjustment.id);
      // Reset to current month's limit (includes mid-month edits)
      const currentLimitValue = currentMonthBudget?.categories?.[category?.name || '']?.monthlyLimit ?? category?.monthlyLimit;
      setNextMonthLimit(currentLimitValue?.toString() || '');
    } catch (err) {
      setError(errorMessage(err, t, 'categories.edit.errors.cancelFailed'));
    }
  };

  const handleDelete = async () => {
    if (!category) return;
    setError('');

    try {
      await deleteCategory.mutateAsync({
        categoryId: category.id,
        categoryName: category.name,
      });
      onClose();
    } catch (err) {
      setError(errorMessage(err, t, 'categories.edit.errors.deleteFailed'));
    }
  };

  const handleClose = () => {
    if (!isPending) {
      setShowDeleteConfirm(false);
      onClose();
    }
  };

  if (!isOpen || !category) return null;

  const tabs = [
    { id: 'edit' as TabType, label: t('categories.edit.tabs.edit'), icon: Edit3 },
    { id: 'merge' as TabType, label: t('categories.edit.tabs.merge'), icon: GitMerge },
    { id: 'adjustment' as TabType, label: t('categories.edit.tabs.adjustment'), icon: Sliders },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      
      {/* Modal - Fixed size */}
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col" style={{ height: '520px' }}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t('categories.edit.title')}
            </h2>
            {/* Help tooltip */}
            <div className="relative group">
              <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
              <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none w-64 z-50">
                <p className="font-medium mb-1">{t('categories.edit.help.title')}</p>
                <ul className="space-y-1 text-gray-300">
                  <li><strong className="text-white">{t('categories.edit.help.detailsLabel')}</strong> {t('categories.edit.help.details')}</li>
                  <li><strong className="text-white">{t('categories.edit.help.mergeLabel')}</strong> {t('categories.edit.help.merge')}</li>
                  <li><strong className="text-white">{t('categories.edit.help.adjustLabel')}</strong> {t('categories.edit.help.adjust')}</li>
                </ul>
              </div>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isPending}
            aria-label={t('common.close')}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const hasAdjustment = tab.id === 'adjustment' && categoryAdjustment;
            
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setError('');
                  setShowDeleteConfirm(false);
                }}
                disabled={isPending}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative
                  ${isActive 
                    ? 'border-b-2 border-green-500 text-green-600 dark:text-green-400'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  }
                  disabled:opacity-50
                `}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
                {hasAdjustment && (
                  <span className="absolute top-1 end-1 sm:relative sm:top-0 sm:end-0 w-2 h-2 bg-orange-500 rounded-full" />
                )}
              </button>
            );
          })}
        </div>

        {/* Content - Flex grow to fill available space */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Error display */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Edit Tab */}
          {activeTab === 'edit' && (
            <div className="space-y-3">
              {/* Name & Color - Inline */}
              <div className="flex gap-3">
                {/* Name */}
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('categories.edit.name')}
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
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
              </div>

              {/* Monthly Limit */}
              <div>
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
                    className="w-full ps-8 pe-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
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
            </div>
          )}

          {/* Merge Tab */}
          {activeTab === 'merge' && (
            <div className="space-y-4">
              {/* Source category */}
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  {t('categories.edit.mergeFrom')}
                </label>
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: category.color }}
                  />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-gray-100">{category.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {t('categories.edit.sourceStats', { amount: `₪${category.monthlyLimit.toLocaleString()}`, count: transactionCount })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Arrow */}
              <div className="flex justify-center">
                <ArrowRight className="h-6 w-6 text-gray-400 rotate-90" />
              </div>

              {/* Target selector */}
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  {t('categories.edit.mergeInto')}
                </label>
                <select
                  value={targetCategoryId}
                  onChange={(e) => setTargetCategoryId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="">{t('categories.edit.selectCategory')}</option>
                  {otherCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (₪{c.monthlyLimit.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              {/* Merge preview */}
              {targetCategory && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg space-y-2">
                  <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-medium">
                    <Info className="h-4 w-4" />
                    {t('categories.edit.afterMerge')}
                  </div>
                  <ul className="text-sm text-blue-600 dark:text-blue-400 space-y-1 ms-6">
                    <li className="flex items-center gap-2">
                      <Check className="h-3 w-3" />
                      {t('categories.edit.newBudget', { amount: `₪${combinedBudget.toLocaleString()}` })}
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3 w-3" />
                      {t('categories.edit.totalTransactions', { count: transactionCount + targetTransactionCount })}
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3 w-3" />
                      {t('categories.edit.willArchive', { name: category.name })}
                    </li>
                  </ul>
                </div>
              )}

              {/* Info */}
              <div className="flex items-start gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400 rounded-lg text-sm">
                <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <p>
                  {t('categories.edit.mergeInfo', { name: category.name })}
                </p>
              </div>
            </div>
          )}

          {/* Adjustment Tab */}
          {activeTab === 'adjustment' && (
            <div className="space-y-3">
              {/* Current vs Next Month - Compact */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">{t('categories.edit.current')}</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {formatCurrency(currentMonthLimit)}
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400 rtl:-scale-x-100" />
                <div className="flex-1 text-end">
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">{t('categories.edit.newPlanned')}</p>
                  {categoryAdjustment ? (
                    <p className={`text-lg font-semibold ${
                      categoryAdjustment.new_limit === 0
                        ? 'text-gray-500 dark:text-gray-400'
                        : categoryAdjustment.adjustment_type === 'increase'
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                    }`}>
                      {categoryAdjustment.new_limit === 0 ? t('categories.edit.deactivated') : formatCurrency(categoryAdjustment.new_limit)}
                    </p>
                  ) : (
                    <p className="text-lg font-semibold text-gray-400 dark:text-gray-500">{t('categories.edit.noChange')}</p>
                  )}
                </div>
              </div>

              {/* Pending adjustment info */}
              {categoryAdjustment && (
                <div className="flex items-center justify-between p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg text-sm">
                  <span className="text-orange-700 dark:text-orange-300">{t('categories.edit.pending')}</span>
                  <button
                    onClick={handleCancelAdjustment}
                    disabled={isPending}
                    className="text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-200 font-medium"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              )}

              {/* New limit input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('categories.edit.newLimit')}
                </label>
                <div className="relative">
                  <span className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-500">₪</span>
                  <input
                    type="number"
                    value={nextMonthLimit}
                    onChange={(e) => setNextMonthLimit(e.target.value)}
                    placeholder="0"
                    min="0"
                    step="50"
                    className="w-full ps-8 pe-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Reason - single line */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('categories.edit.reason')}
                </label>
                <input
                  type="text"
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  placeholder={t('categories.edit.reasonPlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              {/* Quick deactivate */}
              {!categoryAdjustment && category.monthlyLimit > 0 && nextMonthLimit !== '0' && (
                <button
                  type="button"
                  onClick={() => {
                    setNextMonthLimit('0');
                    setAdjustmentReason(t('categories.edit.deactivateReason'));
                  }}
                  className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  <Trans i18nKey="categories.edit.deactivate" components={{ u: <span className="underline" /> }} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer with Delete and Action buttons */}
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          {!showDeleteConfirm ? (
            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isPending}
                className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {t('categories.edit.deleteCategory')}
              </button>
              
              {/* Tab-specific action button - Uniform style: no icons, consistent text */}
              {activeTab === 'edit' && (
                <button
                  onClick={handleSaveEdit}
                  disabled={isPending || !editHasChanges}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {(updateCategory.isPending || renameCategory.isPending) ? t('categories.edit.saving') : t('categories.edit.save')}
                </button>
              )}
              {activeTab === 'merge' && (
                <button
                  onClick={handleMerge}
                  disabled={isPending || !targetCategoryId}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {mergeCategories.isPending ? t('categories.edit.merging') : t('categories.edit.merge')}
                </button>
              )}
              {activeTab === 'adjustment' && (
                <button
                  onClick={handleScheduleAdjustment}
                  disabled={isPending || nextMonthLimit === '' || parseFloat(nextMonthLimit) === category.monthlyLimit}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {scheduleAdjustment.isPending ? t('categories.edit.saving') : t('categories.edit.save')}
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm text-red-600 dark:text-red-400">
                {transactionCount > 0 ? t('categories.edit.deleteKeepsTransactions', { count: transactionCount }) : t('categories.edit.deleteForever')}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isPending}
                  className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isPending}
                  className="flex items-center gap-1 px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                >
                  <Trash2 className="h-3 w-3" />
                  {deleteCategory.isPending ? t('categories.edit.deleting') : t('common.delete')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

