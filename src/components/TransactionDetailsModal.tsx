import React from 'react';
import { X, Calendar, User, Tag, FileText, DollarSign } from 'lucide-react';
import type { Transaction, FamilyMember } from '../types';
import { getUserLocale } from '../utils/locale';
import { useT } from '../hooks/useT';

interface TransactionDetailsModalProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
  formatCurrency: (amount: number) => string;
  familyMembers: FamilyMember[];
}

export const TransactionDetailsModal: React.FC<TransactionDetailsModalProps> = ({
  transaction,
  isOpen,
  onClose,
  formatCurrency,
  familyMembers,
}) => {
  const t = useT();
  if (!isOpen || !transaction) return null;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(getUserLocale(), { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // Look up family member name by ID
  const getFamilyMemberName = (id: string | undefined) => {
    if (!id) return null;
    const member = familyMembers.find(m => m.id === id);
    return member?.name || id;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {t('transactions.details.title')}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Amount */}
          <div className="flex items-center gap-3 p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50">
            <div className={`p-2 rounded-full ${
              transaction.type === 'income' 
                ? 'bg-green-100 dark:bg-green-900/30' 
                : 'bg-red-100 dark:bg-red-900/30'
            }`}>
              <DollarSign className={`h-5 w-5 ${
                transaction.type === 'income'
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`} />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('transactions.details.amount')}</p>
              <p className={`text-2xl font-bold ${
                transaction.type === 'income'
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
              </p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              transaction.type === 'income'
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
            }`}>
              {transaction.type}
            </span>
          </div>

          {/* Date */}
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('transactions.details.date')}</p>
              <p className="text-base font-medium text-gray-900 dark:text-gray-100">
                {formatDate(transaction.date)}
              </p>
            </div>
          </div>

          {/* Category */}
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
              <Tag className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('transactions.details.category')}</p>
              <p className="text-base font-medium text-gray-900 dark:text-gray-100">
                {transaction.category}
              </p>
            </div>
          </div>

          {/* Family Member */}
          {transaction.familyMember && (
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                <User className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600 dark:text-gray-400">{t('transactions.details.familyMember')}</p>
                <p className="text-base font-medium text-gray-900 dark:text-gray-100">
                  {getFamilyMemberName(transaction.familyMember)}
                </p>
              </div>
            </div>
          )}

          {/* Description */}
          {transaction.description && (
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700">
                <FileText className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600 dark:text-gray-400">{t('transactions.details.description')}</p>
                <p dir="auto" className="text-base font-medium text-gray-900 dark:text-gray-100">
                  {transaction.description}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
};
