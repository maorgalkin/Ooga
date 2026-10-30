import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, User, ChevronDown, ExternalLink } from 'lucide-react';
import type { Transaction } from '../../types';
import { getUserLocale } from '../../utils/locale';

interface CategoryTransactionsModalProps {
  isOpen: boolean;
  category: string;
  categories: string[]; // All available categories for dropdown
  transactions: Transaction[];
  formatCurrency: (amount: number) => string;
  getFamilyMemberName: (id: string | undefined) => string | undefined;
  onClose: () => void;
  onEditTransaction: (transaction: Transaction) => void;
  onCategoryChange: (category: string) => void;
  onViewInTransactions: (category: string) => void;
}

/**
 * Modal showing all transactions for a specific category
 * Displays summary stats and full transaction list
 */
export const CategoryTransactionsModal: React.FC<CategoryTransactionsModalProps> = ({
  isOpen,
  category,
  categories,
  transactions,
  formatCurrency,
  getFamilyMemberName,
  onClose,
  onEditTransaction,
  onCategoryChange,
  onViewInTransactions,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  if (!isOpen) return null;

  const categoryTotal = transactions.reduce((sum, t) => sum + t.amount, 0);
  const categoryAverage = transactions.length > 0 ? categoryTotal / transactions.length : 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
          <div className="flex justify-between items-center">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">Category</span>
                {/* Category Dropdown */}
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="flex items-center gap-1 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-xl font-bold"
                  >
                    {category}
                    <ChevronDown className="w-5 h-5" />
                  </button>
                  
                  {isDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 min-w-[200px] max-h-[300px] overflow-y-auto">
                      {categories.map(cat => (
                        <div
                          key={cat}
                          onClick={() => {
                            onCategoryChange(cat);
                            setIsDropdownOpen(false);
                          }}
                          className={`px-4 py-2 cursor-pointer transition-colors ${
                            cat === category 
                              ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-medium' 
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                        >
                          {cat}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-2xl font-bold">Expenses</span>
              </div>
              <p className="text-blue-100 dark:text-blue-200 mt-1">All transactions in this category</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total transactions</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{transactions.length}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total amount</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(categoryTotal)}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Average</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(categoryAverage)}</p>
            </div>
          </div>

          {/* Transactions List */}
          {transactions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No transactions found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((transaction) => (
                <motion.div
                  key={transaction.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => {
                    onEditTransaction(transaction);
                    onClose();
                  }}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100">{transaction.description}</h4>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
                        <span>{new Date(transaction.date).toLocaleDateString(getUserLocale())}</span>
                        {transaction.familyMember && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {getFamilyMemberName(transaction.familyMember)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-red-600">
                        -{formatCurrency(transaction.amount)}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer - Link to Transactions page */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => {
              onViewInTransactions(category);
              onClose();
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors font-medium"
          >
            <ExternalLink className="w-4 h-4" />
            View in Transactions page
          </button>
        </div>
      </motion.div>
    </div>
  );
};
