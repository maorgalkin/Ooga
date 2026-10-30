import React, { useState, useEffect } from 'react';
import { X, Calendar, Filter, Search, DollarSign } from 'lucide-react';
import type { Transaction } from '../types';

interface TransactionFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  onApplyFilter: (filteredTransactions: Transaction[]) => void;
}

interface FilterCriteria {
  dateRange: {
    start: string;
    end: string;
  };
  transactionType: 'all' | 'income' | 'expense';
  category: string;
  familyMember: string;
  amountRange: {
    min: string;
    max: string;
  };
  searchTerm: string;
}

const TransactionFilterModal: React.FC<TransactionFilterModalProps> = ({
  isOpen,
  onClose,
  transactions,
  onApplyFilter,
}) => {
  const [filters, setFilters] = useState<FilterCriteria>({
    dateRange: {
      start: '',
      end: '',
    },
    transactionType: 'all',
    category: 'all',
    familyMember: 'all',
    amountRange: {
      min: '',
      max: '',
    },
    searchTerm: '',
  });

  // Get unique categories and family members from transactions
  const uniqueCategories = Array.from(new Set(transactions.map(t => t.category))).sort();
  const uniqueFamilyMembers = Array.from(new Set(transactions.map(t => t.familyMember).filter(Boolean))).sort();

  // Set default date range (2 years back)
  useEffect(() => {
    if (isOpen && !filters.dateRange.start) {
      const now = new Date();
      const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
      setFilters(prev => ({
        ...prev,
        dateRange: {
          start: twoYearsAgo.toISOString().split('T')[0],
          end: now.toISOString().split('T')[0],
        },
      }));
    }
  }, [isOpen, filters.dateRange.start]);

  const handleFilterChange = (key: keyof FilterCriteria, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const applyFilters = () => {
    let filtered = [...transactions];

    // Date range filter
    if (filters.dateRange.start && filters.dateRange.end) {
      const startDate = new Date(filters.dateRange.start);
      const endDate = new Date(filters.dateRange.end);
      endDate.setHours(23, 59, 59, 999); // Include entire end date
      
      filtered = filtered.filter(t => {
        const transactionDate = new Date(t.date);
        return transactionDate >= startDate && transactionDate <= endDate;
      });
    }

    // Transaction type filter
    if (filters.transactionType !== 'all') {
      filtered = filtered.filter(t => t.type === filters.transactionType);
    }

    // Category filter
    if (filters.category !== 'all') {
      filtered = filtered.filter(t => t.category === filters.category);
    }

    // Family member filter
    if (filters.familyMember !== 'all') {
      filtered = filtered.filter(t => t.familyMember === filters.familyMember);
    }

    // Amount range filter
    if (filters.amountRange.min || filters.amountRange.max) {
      filtered = filtered.filter(t => {
        const amount = t.amount;
        const min = filters.amountRange.min ? parseFloat(filters.amountRange.min) : 0;
        const max = filters.amountRange.max ? parseFloat(filters.amountRange.max) : Infinity;
        return amount >= min && amount <= max;
      });
    }

    // Search term filter
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(t =>
        t.description.toLowerCase().includes(searchLower) ||
        t.category.toLowerCase().includes(searchLower) ||
        (t.familyMember && t.familyMember.toLowerCase().includes(searchLower))
      );
    }

    onApplyFilter(filtered);
    onClose();
  };

  const clearFilters = () => {
    const now = new Date();
    const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
    setFilters({
      dateRange: {
        start: twoYearsAgo.toISOString().split('T')[0],
        end: now.toISOString().split('T')[0],
      },
      transactionType: 'all',
      category: 'all',
      familyMember: 'all',
      amountRange: {
        min: '',
        max: '',
      },
      searchTerm: '',
    });
  };

  const setQuickDateRange = (months: number) => {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
    setFilters(prev => ({
      ...prev,
      dateRange: {
        start: startDate.toISOString().split('T')[0],
        end: now.toISOString().split('T')[0],
      },
    }));
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-2 rtl:space-x-reverse">
            <Filter className="h-5 w-5 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Filter Transactions</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Quick Date Range Buttons */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Quick Date Ranges</label>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Last 3 months', months: 3 },
                { label: 'Last 6 months', months: 6 },
                { label: 'Last year', months: 12 },
                { label: 'Last 2 years', months: 24 },
              ].map((range) => (
                <button
                  key={range.months}
                  onClick={() => setQuickDateRange(range.months)}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Date Range */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
              <div className="relative">
                <Calendar className="absolute start-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="date"
                  value={filters.dateRange.start}
                  onChange={(e) => handleFilterChange('dateRange', { ...filters.dateRange, start: e.target.value })}
                  className="w-full ps-10 pe-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
              <div className="relative">
                <Calendar className="absolute start-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="date"
                  value={filters.dateRange.end}
                  onChange={(e) => handleFilterChange('dateRange', { ...filters.dateRange, end: e.target.value })}
                  className="w-full ps-10 pe-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Search Term */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search Description</label>
            <div className="relative">
              <Search className="absolute start-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search in description, category, or family member..."
                value={filters.searchTerm}
                onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                className="w-full ps-10 pe-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Transaction Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Transaction Type</label>
            <select
              value={filters.transactionType}
              onChange={(e) => handleFilterChange('transactionType', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Types</option>
              <option value="income">Income Only</option>
              <option value="expense">Expense Only</option>
            </select>
          </div>

          {/* Category and Family Member */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <select
                value={filters.category}
                onChange={(e) => handleFilterChange('category', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Categories</option>
                {uniqueCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Family Member</label>
              <select
                value={filters.familyMember}
                onChange={(e) => handleFilterChange('familyMember', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Members</option>
                {uniqueFamilyMembers.map((member) => (
                  <option key={member} value={member}>
                    {member}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Amount Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Amount Range (₪)</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <DollarSign className="absolute start-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="number"
                  placeholder="Min amount"
                  value={filters.amountRange.min}
                  onChange={(e) => handleFilterChange('amountRange', { ...filters.amountRange, min: e.target.value })}
                  className="w-full ps-10 pe-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="relative">
                <DollarSign className="absolute start-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="number"
                  placeholder="Max amount"
                  value={filters.amountRange.max}
                  onChange={(e) => handleFilterChange('amountRange', { ...filters.amountRange, max: e.target.value })}
                  className="w-full ps-10 pe-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center p-6 border-t bg-gray-50">
          <button
            onClick={clearFilters}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Clear Filters
          </button>
          <div className="flex space-x-3 rtl:space-x-reverse">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={applyFilters}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 transition-colors"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransactionFilterModal;
