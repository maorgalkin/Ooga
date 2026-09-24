import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useFinance } from '../context/FinanceContext';
import { useActiveBudget } from '../hooks/useBudgets';
import { useDashboardData } from '../hooks/useDashboardData';
import { useTransactionFilters } from '../hooks/useTransactionFilters';
import { MonthCarousel } from '../components/transactions/MonthCarousel';
import { TransactionFilterTree } from '../components/transactions/TransactionFilterTree';
import { TransactionFilters } from '../components/dashboard/TransactionFilters';
import { TransactionsList } from '../components/dashboard/TransactionsList';
import EditTransactionModal from '../components/EditTransactionModal';
import { formatCurrencyFromSettings } from '../utils/formatCurrency';
import { getHeadingColor, getSubheadingColor } from '../utils/themeColors';
import { getDefaultMonthIndex, getMonthsWithData } from '../utils/dateHelpers';
import { getCategoryGroups, flattenCategoryGroups } from '../utils/transactionFilters';
import type { Transaction } from '../types';

/**
 * Transactions Page
 * Standalone page for browsing and filtering transaction history
 * Features month carousel, multi-dimensional filtering, and transaction editing
 */
export const Transactions: React.FC = () => {
  const { transactions, familyMembers, deleteTransaction } = useFinance();
  const { data: personalBudget } = useActiveBudget();
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  
  // Start on the current month, not the newest month with data (future installments would win)
  const [initialMonthIndex] = useState(() => getDefaultMonthIndex(getMonthsWithData(transactions)));
  const [monthIndex, setMonthIndex] = useState(initialMonthIndex);
  
  // Get month data using dashboard data hook
  const {
    months,
    monthTransactions,
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
    initialMonthIndex,
  });
  
  // Sync month index between hook and local state
  const handleMonthIndexChange = (idx: number) => {
    setMonthIndex(idx);
    updateMonthIndex(idx);
    resetFiltersExceptMonth();
  };
  
  // If transactions weren't loaded yet on mount, jump to the current month once they arrive
  const hasPositionedCarousel = useRef(transactions.length > 0);
  useEffect(() => {
    if (hasPositionedCarousel.current || transactions.length === 0) return;
    hasPositionedCarousel.current = true;
    const index = getDefaultMonthIndex(months);
    setMonthIndex(index);
    updateMonthIndex(index);
  }, [transactions.length, months, updateMonthIndex]);

  // Format currency using budget settings
  const formatCurrency = (amount: number) => {
    return formatCurrencyFromSettings(amount, personalBudget?.global_settings);
  };
  
  // Categories in this month, grouped by type and following the Trans. Type filter
  const categoryGroups = useMemo(
    () => getCategoryGroups(monthTransactions, filters.types),
    [monthTransactions, filters.types]
  );

  // Drop selected categories that are no longer listed (e.g. income categories after deselecting
  // Income), so a hidden filter can't silently empty the list
  useEffect(() => {
    const visible = new Set(flattenCategoryGroups(categoryGroups));
    const kept = filters.categories.filter(c => visible.has(c));
    if (kept.length !== filters.categories.length) setCategoryFilters(kept);
  }, [categoryGroups, filters.categories, setCategoryFilters]);
  
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
          categoryGroups={categoryGroups}
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
              categoryGroups={categoryGroups}
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
            onDeleteTransactions={async (ids) => {
              await Promise.all(ids.map(id => deleteTransaction(id)));
            }}
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
    </div>
  );
};
