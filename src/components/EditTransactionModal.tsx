import React, { useState, useMemo, useEffect } from 'react';
import { useFinance } from '../context/FinanceContext';
import { useActiveBudget } from '../hooks/useBudgets';
import { useT } from '../hooks/useT';
import { X, Calendar } from 'lucide-react';
import type { Transaction } from '../types';
import * as SupabaseService from '../services/supabaseDataService';
import { listConnections, type BankConnection } from '../services/bankImportService';

interface EditTransactionModalProps {
  transaction: Transaction;
  onClose: () => void;
}

const EditTransactionModal: React.FC<EditTransactionModalProps> = ({ transaction, onClose }) => {
  const t = useT();
  const { updateTransaction, deleteTransaction, familyMembers, setTransactions } = useFinance();
  const { data: personalBudget } = useActiveBudget();
  
  const [formData, setFormData] = useState({
    date: transaction.date,
    description: transaction.description,
    amount: transaction.amount.toString(),
    category: transaction.category,
    type: transaction.type,
    familyMember: transaction.familyMember || '',
    paidWith: transaction.paidWith || '',
  });

  // Connected accounts for "Paid with" (manual entries only; imported rows already have their account)
  const isManualEntry = transaction.source !== 'bank_import';
  const [connections, setConnections] = useState<BankConnection[]>([]);
  useEffect(() => {
    if (isManualEntry) listConnections().then(setConnections).catch(() => {});
  }, [isManualEntry]);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [installmentDeleteOption, setInstallmentDeleteOption] = useState<'single' | 'future' | 'all'>('single');
  
  // Check if this is part of an installment group
  const isInstallment = !!transaction.installment_group_id;

  // Converting a regular expense into an installment plan
  const [convertToInstallments, setConvertToInstallments] = useState(false);
  const [numberOfInstallments, setNumberOfInstallments] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canConvertToInstallments = !isInstallment && formData.type === 'expense';
  const installmentCount = parseInt(numberOfInstallments) || 0;
  const totalAmount = parseFloat(formData.amount) || 0;
  const installmentAmounts = installmentCount >= 2 && installmentCount <= 36
    ? SupabaseService.splitInstallmentAmounts(totalAmount, installmentCount)
    : [];

  // Get currency symbol - use personal budget if available
  const getCurrencySymbol = (currency: string) => {
    switch (currency) {
      case 'USD': return '$';
      case 'ILS': return '₪';
      case 'EUR': return '€';
      case 'GBP': return '£';
      default: return currency;
    }
  };

  const currency = personalBudget?.global_settings?.currency || 'ILS';
  const currencySymbol = getCurrencySymbol(currency);

  // Get active expense categories from user's active budget
  const expenseCategories = useMemo(() => {
    if (!personalBudget) {
      // No personal budget - return empty array (user should create one)
      return [];
    }
    
    // Get active categories from global settings
    const activeCategories = personalBudget.global_settings?.activeExpenseCategories || [];
    
    // Filter to only include categories that are both in activeCategories list AND marked as active
    const categories = activeCategories.filter(catName => {
      const categoryConfig = personalBudget.categories[catName];
      return categoryConfig && categoryConfig.isActive !== false;
    });
    
    // Sort alphabetically with "Other" at the end
    return categories
      .filter(cat => cat !== 'Other')
      .sort()
      .concat(categories.includes('Other') ? ['Other'] : []);
  }, [personalBudget]);

  // Income categories - sorted alphabetically with "Other" last
  const incomeCategories = [
    'Gift',
    'Government Allowance',
    'Rent',
    'Salary',
    'Other'
  ];

  // Get categories based on transaction type
  const currentCategories = formData.type === 'income' ? incomeCategories : expenseCategories;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const shouldConvert = convertToInstallments && canConvertToInstallments;
    if (shouldConvert && (installmentCount < 2 || installmentCount > 36)) {
      alert(t('transactions.edit.installmentsRange'));
      return;
    }

    setIsSubmitting(true);
    try {
      if (shouldConvert) {
        // Create the installment series first, then remove the original,
        // so a failure never leaves the user without the transaction
        await SupabaseService.addInstallmentTransactions(
          {
            ...formData,
            familyMember: formData.familyMember || undefined,
            amount: totalAmount,
          },
          installmentCount,
          installmentAmounts
        );
        await SupabaseService.deleteTransaction(transaction.id);
        const allTransactions = await SupabaseService.getTransactions();
        setTransactions(allTransactions);
      } else {
        await updateTransaction(transaction.id, {
          ...formData,
          amount: parseFloat(formData.amount) || 0,
        });
      }
      onClose();
    } catch (error) {
      console.error('Error updating transaction:', error);
      alert(t('transactions.edit.updateFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    try {
      if (isInstallment && transaction.installment_group_id) {
        // Handle installment deletion based on user choice
        if (installmentDeleteOption === 'all') {
          await SupabaseService.deleteInstallmentGroup(transaction.installment_group_id);
        } else if (installmentDeleteOption === 'future' && transaction.installment_number) {
          await SupabaseService.deleteFutureInstallments(
            transaction.installment_group_id,
            transaction.installment_number
          );
        } else {
          // Delete just this single installment
          await deleteTransaction(transaction.id);
        }
        // Refresh transactions list
        const allTransactions = await SupabaseService.getTransactions();
        setTransactions(allTransactions);
      } else {
        // Regular transaction deletion
        await deleteTransaction(transaction.id);
      }
      onClose();
    } catch (error) {
      console.error('Error deleting transaction:', error);
      alert(t('transactions.edit.deleteFailed'));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
      // If changing type, reset category if it's not valid for the new type
      if (name === 'type') {
        const newType = value as 'income' | 'expense';
        const newCategories = newType === 'income' ? incomeCategories : expenseCategories;
        const categoryStillValid = newCategories.includes(prev.category);
        
        return {
          ...prev,
          type: newType,
          category: categoryStillValid ? prev.category : '',
        };
      }
      
      return {
        ...prev,
        [name]: value,
      };
    });
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto overscroll-contain touch-pan-y">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">{t('transactions.list.edit')}</h2>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Date */}
          <div>
            <label htmlFor="edit-date" className="block text-sm font-medium text-gray-700 mb-1">
              {t('transactions.details.date')}
            </label>
            <input
              id="edit-date"
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="edit-description" className="block text-sm font-medium text-gray-700 mb-1">
              {t('transactions.details.description')}
            </label>
            <input
              id="edit-description"
              type="text"
              name="description"
              value={formData.description}
              onChange={handleChange}
              required
              placeholder={t('transactions.edit.descriptionPlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Amount */}
          <div>
            <label htmlFor="edit-amount" className="block text-sm font-medium text-gray-700 mb-1">
              {convertToInstallments && canConvertToInstallments ? t('transactions.edit.totalAmount') : t('transactions.details.amount')} ({currencySymbol})
            </label>
            <input
              id="edit-amount"
              type="number"
              name="amount"
              value={formData.amount}
              onChange={handleChange}
              required
              min="0"
              step="0.01"
              placeholder="0.00"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Type */}
          <div>
            <label htmlFor="edit-type" className="block text-sm font-medium text-gray-700 mb-1">
              {t('transactions.edit.type')}
            </label>
            <select
              id="edit-type"
              name="type"
              value={formData.type}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="expense">{t('transactions.filters.expense')}</option>
              <option value="income">{t('transactions.filters.income')}</option>
            </select>
          </div>

          {/* Category */}
          <div>
            <label htmlFor="edit-category" className="block text-sm font-medium text-gray-700 mb-1">
              {t('transactions.details.category')}
            </label>
            <select
              id="edit-category"
              name="category"
              value={formData.category}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t('transactions.edit.selectCategory')}</option>
              {currentCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Family Member */}
          <div>
            <label htmlFor="edit-family-member" className="block text-sm font-medium text-gray-700 mb-1">
              {t('transactions.edit.familyMemberOptional')}
            </label>
            <select
              id="edit-family-member"
              name="familyMember"
              value={formData.familyMember}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t('transactions.edit.none')}</option>
              {familyMembers.map(member => (
                <option key={member.id} value={member.id}>{member.name}</option>
              ))}
            </select>
          </div>

          {/* Paid with / Received in (manual entries) */}
          {isManualEntry && connections.length > 0 && (
            <div>
              <label htmlFor="edit-paid-with" className="block text-sm font-medium text-gray-700 mb-1">
                {t(formData.type === 'income' ? 'transactions.form.receivedIn' : 'transactions.form.paidWith')}
              </label>
              <select
                id="edit-paid-with"
                name="paidWith"
                value={formData.paidWith}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{t('transactions.form.cash')}</option>
                {connections.map(conn => (
                  <option key={conn.id} value={conn.id}>{conn.display_name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Convert to installments (regular expenses only) */}
          {canConvertToInstallments && (
            <div className="border-t border-gray-200 pt-4 space-y-2">
              <div className="flex items-center space-x-3 rtl:space-x-reverse">
                <div className="flex items-center space-x-2 rtl:space-x-reverse flex-shrink-0">
                  <input
                    id="edit-installments-checkbox"
                    type="checkbox"
                    checked={convertToInstallments}
                    onChange={(e) => {
                      setConvertToInstallments(e.target.checked);
                      if (!e.target.checked) setNumberOfInstallments('');
                    }}
                    className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="edit-installments-checkbox" className="flex items-center text-sm font-medium text-gray-700 whitespace-nowrap">
                    <Calendar className="h-4 w-4 me-1" />
                    {t('transactions.edit.convert')}
                  </label>
                </div>

                {convertToInstallments && (
                  <input
                    id="edit-installments-count"
                    type="number"
                    min="2"
                    max="36"
                    value={numberOfInstallments}
                    onChange={(e) => setNumberOfInstallments(e.target.value)}
                    placeholder={t('transactions.form.monthsPlaceholder')}
                    required
                    className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>

              {convertToInstallments && (
                <p className="text-xs text-gray-500">
                  {installmentAmounts.length > 0
                    ? t('transactions.edit.installmentsSummary', {
                        split: installmentAmounts[0] !== installmentAmounts[1]
                          ? `${currencySymbol}${installmentAmounts[0].toFixed(2)} + ${installmentCount - 1} × ${currencySymbol}${installmentAmounts[1].toFixed(2)}`
                          : `${installmentCount} × ${currencySymbol}${installmentAmounts[0].toFixed(2)}`,
                        total: `${currencySymbol}${totalAmount.toFixed(2)}`,
                      })
                    : t('transactions.edit.installmentsHint')}
                </p>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
            {!showDeleteConfirm ? (
              <>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition-colors font-medium disabled:opacity-50"
                >
                  {convertToInstallments && canConvertToInstallments ? t('transactions.edit.createInstallments') : t('transactions.edit.saveChanges')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex-1 bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition-colors font-medium"
                >
                  {t('common.delete')}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 transition-colors font-medium"
                >
                  {t('common.cancel')}
                </button>
              </>
            ) : (
              <div className="w-full space-y-3">
                {isInstallment ? (
                  <>
                    <div className="text-sm text-gray-700 font-medium mb-3">
                      {t('transactions.edit.seriesNotice', { number: transaction.installment_number, total: transaction.installment_total })}
                    </div>
                    
                    {/* Installment deletion options */}
                    <div className="space-y-2">
                      <label className="flex items-start space-x-2 rtl:space-x-reverse cursor-pointer">
                        <input
                          type="radio"
                          name="deleteOption"
                          value="single"
                          checked={installmentDeleteOption === 'single'}
                          onChange={(e) => setInstallmentDeleteOption(e.target.value as 'single')}
                          className="mt-1"
                        />
                        <span className="text-sm text-gray-700">
                          {t('transactions.edit.deleteSingle', { number: transaction.installment_number, total: transaction.installment_total })}
                        </span>
                      </label>
                      
                      <label className="flex items-start space-x-2 rtl:space-x-reverse cursor-pointer">
                        <input
                          type="radio"
                          name="deleteOption"
                          value="future"
                          checked={installmentDeleteOption === 'future'}
                          onChange={(e) => setInstallmentDeleteOption(e.target.value as 'future')}
                          className="mt-1"
                        />
                        <span className="text-sm text-gray-700">
                          {t('transactions.edit.deleteFuture', { number: transaction.installment_number, total: transaction.installment_total })}
                        </span>
                      </label>
                      
                      <label className="flex items-start space-x-2 rtl:space-x-reverse cursor-pointer">
                        <input
                          type="radio"
                          name="deleteOption"
                          value="all"
                          checked={installmentDeleteOption === 'all'}
                          onChange={(e) => setInstallmentDeleteOption(e.target.value as 'all')}
                          className="mt-1"
                        />
                        <span className="text-sm text-gray-700">
                          {t('transactions.edit.deleteAll', { total: transaction.installment_total })}
                        </span>
                      </label>
                    </div>
                    
                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={handleDelete}
                        className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors font-medium"
                      >
                        {t('transactions.edit.confirmDelete')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(false)}
                        className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 transition-colors font-medium"
                      >
                  {t('common.cancel')}
                </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-full text-center text-sm text-red-600 font-medium mb-2">
                      {t('transactions.edit.areYouSure')}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleDelete}
                        className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors font-medium"
                      >
                        {t('transactions.edit.yesDelete')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(false)}
                        className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 transition-colors font-medium"
                      >
                  {t('common.cancel')}
                </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditTransactionModal;
