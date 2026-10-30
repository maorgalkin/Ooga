import React, { useState, useMemo } from 'react';
import { X, Calendar, Search } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { getCategoryColor } from '../utils/categoryColors';
import { useActiveBudget } from '../hooks/useBudgets';
import { formatCurrencyFromSettings } from '../utils/formatCurrency';
import { getUserLocale } from '../utils/locale';

interface CustomDateRangeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CustomDateRangeModal: React.FC<CustomDateRangeModalProps> = ({ isOpen, onClose }) => {
  const { transactions, familyMembers } = useFinance();
  const { data: activeBudget } = useActiveBudget();
  const now = new Date();

  // Generate last 24 months for selection
  const availableMonths = useMemo(() => {
    return Array.from({ length: 24 }, (_, index) => {
      const d = new Date(now.getFullYear(), now.getMonth() - index, 1);
      return {
        value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: d.toLocaleString(getUserLocale(), { month: 'long', year: 'numeric' }),
        date: d,
      };
    });
  }, []);

  const [startMonth, setStartMonth] = useState(availableMonths[3]?.value || '');
  const [endMonth, setEndMonth] = useState(availableMonths[0]?.value || '');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const formatCurrency = (amount: number) => {
    return formatCurrencyFromSettings(amount, activeBudget?.global_settings);
  };

  const filteredTransactions = useMemo(() => {
    if (!startMonth || !endMonth) return [];

    const [startYear, startMonthNum] = startMonth.split('-').map(Number);
    const [endYear, endMonthNum] = endMonth.split('-').map(Number);
    const startDate = new Date(startYear, startMonthNum - 1, 1);
    const endDate = new Date(endYear, endMonthNum, 0, 23, 59, 59);

    let filtered = transactions.filter(t => {
      const d = new Date(t.date);
      return d >= startDate && d <= endDate;
    });

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(t => t.type === filterType);
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(t => {
        const memberName = t.familyMember 
          ? familyMembers.find(m => m.id === t.familyMember)?.name 
          : '';
        return (
          t.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
          memberName?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      });
    }

    // Sort by date (newest first)
    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, startMonth, endMonth, filterType, searchTerm, familyMembers]);

  const summary = useMemo(() => {
    const income = filteredTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const expenses = filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    return { income, expenses, net: income - expenses };
  }, [filteredTransactions]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Calendar className="h-6 w-6 text-blue-600" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Custom date range
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Filters */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Start Month */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                From
              </label>
              <select
                value={startMonth}
                onChange={(e) => setStartMonth(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                {availableMonths.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
            </div>

            {/* End Month */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                To
              </label>
              <select
                value={endMonth}
                onChange={(e) => setEndMonth(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                {availableMonths.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Type
              </label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as 'all' | 'income' | 'expense')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                <option value="all">All</option>
                <option value="income">Income</option>
                <option value="expense">Expenses</option>
              </select>
            </div>

            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Search
              </label>
              <div className="relative">
                <Search className="absolute start-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search..."
                  className="w-full ps-10 pe-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
              <p className="text-xs font-medium text-green-600 dark:text-green-400 mb-1">Income</p>
              <p className="text-lg font-bold text-green-700 dark:text-green-300">
                {formatCurrency(summary.income)}
              </p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
              <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">Expenses</p>
              <p className="text-lg font-bold text-red-700 dark:text-red-300">
                {formatCurrency(summary.expenses)}
              </p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
              <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">Net</p>
              <p className={`text-lg font-bold ${summary.net >= 0 ? 'text-blue-700 dark:text-blue-300' : 'text-red-700 dark:text-red-300'}`}>
                {formatCurrency(summary.net)}
              </p>
            </div>
          </div>
        </div>

        {/* Transaction List */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredTransactions.length > 0 ? (
            <div className="space-y-2">
              {filteredTransactions.map(t => {
                const categoryColors = getCategoryColor(t.category, t.type);
                const memberName = t.familyMember 
                  ? familyMembers.find(m => m.id === t.familyMember)?.name 
                  : null;

                return (
                  <div
                    key={t.id}
                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${categoryColors.bg} ${categoryColors.border} ${categoryColors.text} border`}>
                            {t.category}
                          </span>
                          {memberName && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {memberName}
                            </span>
                          )}
                        </div>
                        {t.description && (
                          <p className="text-sm text-gray-700 dark:text-gray-300 mb-1 truncate">
                            {t.description}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(t.date).toLocaleDateString(getUserLocale(), { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric' 
                          })}
                        </p>
                      </div>
                      <div className={`text-end font-bold ${t.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
              <Calendar className="h-16 w-16 mb-4 opacity-30" />
              <p className="text-lg font-medium">No transactions found</p>
              <p className="text-sm">Try adjusting your date range or filters</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''} found
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomDateRangeModal;
