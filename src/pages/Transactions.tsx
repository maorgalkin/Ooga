import React, { useState, useMemo } from 'react';
import { Download } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { useActiveBudget } from '../hooks/useBudgets';
import { useDashboardData } from '../hooks/useDashboardData';
import { useTransactionFilters } from '../hooks/useTransactionFilters';
import { MonthCarousel } from '../components/transactions/MonthCarousel';
import { TransactionFilterTree } from '../components/transactions/TransactionFilterTree';
import { TransactionFilters } from '../components/dashboard/TransactionFilters';
import { TransactionsList } from '../components/dashboard/TransactionsList';
import EditTransactionModal from '../components/EditTransactionModal';
import BankImportModal from '../components/BankImportModal';
import { formatCurrencyFromSettings } from '../utils/formatCurrency';
import { getHeadingColor, getSubheadingColor } from '../utils/themeColors';
import type { Transaction } from '../types';

/**
 * Transactions Page
 * Standalone page for browsing and filtering transaction history
 * Features month carousel, multi-dimensional filtering, and transaction editing
 */
export const Transactions: React.FC = () => {
  const { transactions, familyMembers, refreshTransactions } = useFinance();
  const { data: personalBudget } = useActiveBudget();
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [showBankImport, setShowBankImport] = useState(false);
  
  // Initialize with month index from filter hook
  const [monthIndex, setMonthIndex] = useState(0);
  
  // Get month data using dashboard data hook
  const {
    months,
    monthCategoryData,
    getTransactionsForMonth,
  } = useDashboardData({
    transactions,
    familyMembers,
    budgetConfig: null,
    activeMonthIndex: monthIndex,
  });
  
  // Use transaction filters hook for state management and filtering
  const {
    filteredTransactions,
    filters,
    setTypeFilters,
    setMemberFilters,
    setCategoryFilters,
    setTypeFilter,
    setMemberFilter,
    setMonthFilter,
    setCategoryFilter,
    setMonthIndex: updateMonthIndex,
    resetFiltersExceptMonth,
  } = useTransactionFilters({
    transactions,
    months,
    getTransactionsForMonth,
    initialMonthIndex: 0,
  });
  
  // Sync month index between hook and local state
  const handleMonthIndexChange = (idx: number) => {
    setMonthIndex(idx);
    updateMonthIndex(idx);
    resetFiltersExceptMonth();
  };
  
  // Format currency using budget settings
  const formatCurrency = (amount: number) => {
    return formatCurrencyFromSettings(amount, personalBudget?.global_settings);
  };
  
  // Extract unique categories from current month data for filter dropdown
  const availableCategories = useMemo(() => {
    return monthCategoryData.map(c => c.category).sort();
  }, [monthCategoryData]);
  
  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className={`text-3xl font-bold ${getHeadingColor('blue')} mb-2`}>
            Transactions
          </h1>
          <p className={getSubheadingColor('blue')}>
            View and manage your transaction history
          </p>
        </div>
        <button
          onClick={() => setShowBankImport(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors shadow-sm"
          title="Import from Discount Bank"
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">Import from Bank</span>
        </button>
      </div>
      
      {/* Month Carousel */}
      <MonthCarousel
        months={months}
        activeIndex={monthIndex}
        onIndexChange={handleMonthIndexChange}
      />

      {/* Desktop: Two-column layout with filter tree. Mobile: Stack vertically */}
      <div className="lg:grid lg:grid-cols-[300px_1fr] lg:gap-6">
        {/* Left Sidebar: Filter Tree (Desktop/Tablet only) */}
        <TransactionFilterTree
          selectedTypes={filters.types}
          selectedMembers={filters.members}
          selectedCategories={filters.categories}
          familyMembers={familyMembers}
          categories={availableCategories}
          onTypeChange={setTypeFilters}
          onMemberChange={setMemberFilters}
          onCategoryChange={setCategoryFilters}
        />

        {/* Right Content: Filters + Transactions List */}
        <div className="space-y-6">
          {/* Transaction Filters (Mobile dropdown, hidden on desktop) */}
          <div className="lg:hidden">
            <TransactionFilters
              typeFilter={filters.types.length === 0 ? 'all' : filters.types.length === 1 ? filters.types[0] : 'all'}
              memberFilter={filters.members.length === 0 ? 'all' : filters.members.length === 1 ? filters.members[0] : 'all'}
              monthFilter={filters.month}
              categoryFilter={filters.categories.length === 0 ? 'all' : filters.categories.length === 1 ? filters.categories[0] : 'all'}
              familyMembers={familyMembers}
              categories={availableCategories}
              months={months}
              activeMonthIndex={monthIndex}
              onTypeChange={setTypeFilter}
              onMemberChange={setMemberFilter}
              onMonthChange={(month, monthIndex) => {
                setMonthFilter(month, monthIndex);
                if (monthIndex !== undefined) {
                  setMonthIndex(monthIndex);
                }
              }}
              onCategoryChange={setCategoryFilter}
              onMoreClick={() => {
                // Future: Open advanced filters modal
              }}
            />
          </div>

          {/* Transactions List */}
          <TransactionsList
            transactions={filteredTransactions}
            familyMembers={familyMembers}
            personalBudget={personalBudget}
            formatCurrency={formatCurrency}
            onEditTransaction={setEditingTransaction}
            emptyMessage="No transactions match your filters"
          />
        </div>
      </div>

      {/* Edit Transaction Modal */}
      {editingTransaction && (
        <EditTransactionModal
          transaction={editingTransaction}
          onClose={() => setEditingTransaction(null)}
        />
      )}

      {/* Bank Import Modal */}
      {showBankImport && (
        <BankImportModal
          onClose={() => setShowBankImport(false)}
          onImportComplete={() => refreshTransactions()}
        />
      )}
    </div>
  );
};
