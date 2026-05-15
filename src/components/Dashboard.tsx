import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { useAuth } from '../contexts/AuthContext';
import { useActiveBudget, useCurrentMonthBudget, useAutoApplyScheduledAdjustments } from '../hooks/useBudgets';
import { budgetService } from '../services/budgetService';
import { userAlertViewService } from '../services/userAlertViewService';
import { BudgetPerformanceCard } from './BudgetPerformanceCard';
import { TransactionDetailsModal } from './TransactionDetailsModal';
import EditTransactionModal from './EditTransactionModal';
import HouseholdSettingsModal from './HouseholdSettingsModal';
import { BudgetManagement } from '../pages/BudgetManagement';
import { InsightsPage } from '../pages/InsightsPage';
import { generateDummyTransactions, countDummyTransactions, isDummyTransaction } from '../utils/dummyData';
import { useDashboardData } from '../hooks/useDashboardData';
import { getUserLocale } from '../utils/locale';
import { DashboardTabNavigation } from './dashboard/DashboardTabNavigation';
import { ExpenseChart } from './dashboard/ExpenseChart';
import { formatCurrencyFromSettings } from '../utils/formatCurrency';
import { DummyDataControls } from './dashboard/DummyDataControls';
import { CategoryTransactionsModal } from './dashboard/CategoryTransactionsModal';
import { Transactions } from '../pages/Transactions';
import { BuildInfo } from './BuildInfo';
import CustomDateRangeModal from './CustomDateRangeModal';
import * as HouseholdService from '../services/householdService';
import type { Transaction, BudgetConfiguration } from '../types';
import type { Household, HouseholdMember } from '../services/householdService';
import { getHeadingColor, getSubheadingColor } from '../utils/themeColors';

const Dashboard: React.FC = () => {
  const { transactions, familyMembers, addTransaction, deleteTransaction } = useFinance();
  const { data: personalBudget } = useActiveBudget();
  const { data: monthlyBudget } = useCurrentMonthBudget();
  const { user } = useAuth();
  
  // Auto-apply any pending scheduled adjustments for the current month
  useAutoApplyScheduledAdjustments(!!user);
  
  const [searchParams, setSearchParams] = useSearchParams();
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Check OS/browser dark mode preference
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });
  
  // Initialize activeTab from URL query parameter
  const tabParam = searchParams.get('tab');
  const initialTab = (tabParam === 'budget' || tabParam === 'transactions' || tabParam === 'dashboard' || tabParam === 'insights') 
    ? tabParam 
    : 'dashboard';
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'budget' | 'insights'>(initialTab);
  
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isHouseholdSettingsModalOpen, setIsHouseholdSettingsModalOpen] = useState(false);
  const [selectedDesktopCategory, setSelectedDesktopCategory] = useState<string | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isCustomDateRangeModalOpen, setIsCustomDateRangeModalOpen] = useState(false);
  const [showBreakdownInHeader, setShowBreakdownInHeader] = useState(false);
  const [viewedAlertIds, setViewedAlertIds] = useState<Set<string>>(new Set());
  const [viewingTransactionDetails, setViewingTransactionDetails] = useState<Transaction | null>(null);
  const expenseChartRef = React.useRef<HTMLDivElement>(null);

  // Household data
  const [household, setHousehold] = useState<Household | null>(null);

  // Calculate budget alerts for the current month
  // Count unique categories with alerts/warnings (not individual alert IDs)
  const currentAlertsCount = useMemo(() => {
    if (!personalBudget) return 0;
    
    // Use monthly budget categories if available (includes mid-month edits)
    const categories = monthlyBudget?.categories 
      ? { ...monthlyBudget.categories }
      : { ...personalBudget.categories };
    
    const budgetConfig: BudgetConfiguration = {
      version: "2.0.0",
      lastUpdated: monthlyBudget?.updated_at || personalBudget.updated_at,
      categories,
      globalSettings: personalBudget.global_settings
    };
    
    const currentDate = new Date();
    const monthName = currentDate.toLocaleDateString('en-US', { month: 'long' });
    const year = currentDate.getFullYear();
    
    const analysis = budgetService.analyzeBudgetPerformanceWithConfig(
      transactions,
      monthName,
      year,
      budgetConfig
    );
    
    // Get unique categories with alerts that haven't been viewed
    const unviewedCategories = new Set<string>();
    const unviewedAlertsByCategory: Record<string, string[]> = {};
    
    analysis.alerts.forEach(alert => {
      if (!viewedAlertIds.has(alert.id)) {
        unviewedCategories.add(alert.category);
        if (!unviewedAlertsByCategory[alert.category]) {
          unviewedAlertsByCategory[alert.category] = [];
        }
        unviewedAlertsByCategory[alert.category].push(alert.type);
      }
    });
    
    return unviewedCategories.size;
  }, [personalBudget, monthlyBudget, transactions, viewedAlertIds]);

  // Memoize callback to prevent effect re-runs
  const handleBreakdownVisible = useCallback((visible: boolean) => {
    setShowBreakdownInHeader(visible);
  }, []);

  // Mark all current alerts as viewed
  const handleAlertsViewed = useCallback(async () => {
    if (!personalBudget || !user?.id || !household?.id) return;
    
    // Use monthly budget categories if available (includes mid-month edits)
    const categories = monthlyBudget?.categories 
      ? { ...monthlyBudget.categories }
      : { ...personalBudget.categories };
    
    const budgetConfig: BudgetConfiguration = {
      version: "2.0.0",
      lastUpdated: monthlyBudget?.updated_at || personalBudget.updated_at,
      categories,
      globalSettings: personalBudget.global_settings
    };
    
    const currentDate = new Date();
    const monthName = currentDate.toLocaleDateString('en-US', { month: 'long' });
    const year = currentDate.getFullYear();
    
    const analysis = budgetService.analyzeBudgetPerformanceWithConfig(
      transactions,
      monthName,
      year,
      budgetConfig
    );
    
    // Get alert IDs to mark as viewed
    const alertIds = analysis.alerts.map(alert => alert.id);
    
    // Save to database
    await userAlertViewService.markAlertsAsViewed(user.id, alertIds, household.id);
    
    // Update local state
    setViewedAlertIds(prev => {
      const newSet = new Set(prev);
      alertIds.forEach(id => newSet.add(id));
      return newSet;
    });
  }, [personalBudget, monthlyBudget, transactions, user?.id, household?.id]);

  // Handle category click from Budget Performance Card
  const handleCategoryClick = useCallback((category: string) => {
    // Set the selected category
    setSelectedDesktopCategory(category);
    
    // Scroll to expense chart with a small delay to ensure state updates
    setTimeout(() => {
      if (expenseChartRef.current) {
        expenseChartRef.current.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }
    }, 100);
  }, []);

  // Track dark mode changes based on OS/browser preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      setIsDarkMode(e.matches);
    };
    
    // Set initial value
    setIsDarkMode(mediaQuery.matches);
    
    // Listen for changes
    mediaQuery.addEventListener('change', handleChange);
    
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Load viewed alert IDs from database and household data
  useEffect(() => {
    const loadData = async () => {
      if (!user?.id) return;
      
      try {
        const [viewedIds, householdData] = await Promise.all([
          userAlertViewService.getViewedAlertIds(user.id),
          HouseholdService.getUserHousehold(),
        ]);
        
        setViewedAlertIds(viewedIds);
        setHousehold(householdData);
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };
    
    loadData();
  }, [user?.id]);

  // Listen to URL changes and update activeTab accordingly
  useEffect(() => {
    const urlTab = searchParams.get('tab');
    const targetTab = (urlTab === 'budget' || urlTab === 'transactions' || urlTab === 'insights') ? urlTab : 'dashboard';
    
    if (targetTab !== activeTab) {
      setActiveTab(targetTab);
    }
  }, [searchParams]);

  // Sync URL with activeTab changes (when user clicks tabs)
  useEffect(() => {
    const currentUrlTab = searchParams.get('tab');
    
    if (activeTab === 'dashboard' && currentUrlTab !== null) {
      // Remove tab param for dashboard (clean URL)
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('tab');
      setSearchParams(newParams, { replace: true });
    } else if (activeTab !== 'dashboard' && currentUrlTab !== activeTab) {
      // Set tab param for transactions/budget
      const newParams = new URLSearchParams(searchParams);
      newParams.set('tab', activeTab);
      setSearchParams(newParams, { replace: true });
    }
  }, [activeTab]);

  // Use custom hook for data management
  // Dashboard tab uses null (current month only), Transactions tab uses transactionsMonthIndex
  const {
    monthTransactions: dashboardMonthTransactions,
    monthCategoryData: dashboardCategoryData,
    selectedMonthDate: dashboardMonthDate,
    getFamilyMemberName,
  } = useDashboardData({
    transactions,
    familyMembers,
    budgetConfig: null,
    activeMonthIndex: null, // Always null for Dashboard - current month only
  });

  const formatCurrency = (amount: number) => {
    return formatCurrencyFromSettings(amount, personalBudget?.global_settings);
  };

  // Dummy data handlers
  const handleAddDummyData = async () => {
    // Use current month for dummy data
    const monthStart = new Date(dashboardMonthDate.getFullYear(), dashboardMonthDate.getMonth(), 1);
    const monthEnd = new Date(dashboardMonthDate.getFullYear(), dashboardMonthDate.getMonth() + 1, 0, 23, 59, 59);
    const memberIds = familyMembers.map(m => m.id);
    const dummyTransactions = generateDummyTransactions(monthStart, monthEnd, memberIds);
    
    try {
      for (const transaction of dummyTransactions) {
        await addTransaction(transaction);
      }
      alert(`Added ${dummyTransactions.length} dummy transactions to ${monthStart.toLocaleDateString(getUserLocale(), { month: 'long', year: 'numeric' })}`);
    } catch (error) {
      console.error('Error adding dummy data:', error);
      alert('Error adding dummy data. Check console for details.');
    }
  };

  const handleRemoveDummyData = async () => {
    const dummyCount = countDummyTransactions(transactions);
    
    if (dummyCount === 0) {
      alert('No dummy data found to remove.');
      return;
    }

    if (!confirm(`Remove all ${dummyCount} dummy transactions?`)) {
      return;
    }

    try {
      const dummyIds = transactions.filter(t => isDummyTransaction(t)).map(t => t.id);
      for (const id of dummyIds) {
        await deleteTransaction(id);
      }
      alert(`Removed ${dummyCount} dummy transactions.`);
    } catch (error) {
      console.error('Error removing dummy data:', error);
      alert('Error removing dummy data. Check console for details.');
    }
  };

  const handleClearViewedAlerts = async () => {
    if (!user?.id) return;
    
    await userAlertViewService.clearAllViewedAlerts(user.id);
    setViewedAlertIds(new Set());
  };

  // Dynamic background based on active tab with subtle textures
  const getBackgroundClass = () => {
    switch (activeTab) {
      case 'dashboard':
        return 'bg-purple-100 dark:bg-purple-950/30';
      case 'transactions':
        return 'bg-blue-100 dark:bg-blue-950/30';
      case 'budget':
        return 'bg-green-100 dark:bg-green-950/30';
      case 'insights':
        return 'bg-indigo-100 dark:bg-indigo-950/30';
      default:
        return 'bg-white dark:bg-gray-900';
    }
  };

  const getTextureStyle = (): React.CSSProperties => {
    // Flat honeycomb hexagon pattern with white lines (only in light mode, flat in dark mode)
    if (isDarkMode) {
      return {}; // No pattern in dark mode
    }
    
    const lineWidth = 2;
    const lineStart = 50;
    const lineEnd = lineStart + lineWidth;
    
    return {
      backgroundImage: [
        `repeating-linear-gradient(0deg, transparent 0px, transparent ${lineStart}px, rgba(255, 255, 255, 0.2) ${lineStart}px, rgba(255, 255, 255, 0.2) ${lineEnd}px)`,
        `repeating-linear-gradient(60deg, transparent 0px, transparent ${lineStart}px, rgba(255, 255, 255, 0.2) ${lineStart}px, rgba(255, 255, 255, 0.2) ${lineEnd}px)`,
        `repeating-linear-gradient(120deg, transparent 0px, transparent ${lineStart}px, rgba(255, 255, 255, 0.2) ${lineStart}px, rgba(255, 255, 255, 0.2) ${lineEnd}px)`
      ].join(', '),
      backgroundSize: '100% 100%',
    };
  };

  return (
    <div 
      className={`min-h-screen transition-all duration-500 ${getBackgroundClass()}`}
      style={getTextureStyle()}
    >
      <div className="px-3 sm:px-4 lg:px-6 py-8 max-w-7xl mx-auto">
      
      {/* Tab Navigation */}
      <DashboardTabNavigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        alertsCount={currentAlertsCount}
      />

      {activeTab === 'dashboard' && (
        <div>
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className={`text-3xl font-bold ${getHeadingColor('purple')} mb-1`}>
                  {dashboardMonthDate.toLocaleDateString(getUserLocale(), { month: 'long' })} '{String(dashboardMonthDate.getFullYear()).slice(2)} Dashboard
                </h1>
                <div className="flex items-center gap-3">
                  <p className={getSubheadingColor('purple')}>
                    {household?.name ? `${household.name}'s budget at a glance` : 'Your monthly budget at a glance'}
                  </p>
                  <button
                    onClick={() => setIsHouseholdSettingsModalOpen(true)}
                    className="text-xs text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 underline transition-colors"
                  >
                    {household?.name ? 'Manage household →' : 'Set up household →'}
                  </button>
                </div>
              </div>
              
              {/* Dummy Data Controls - Development Only */}
              {import.meta.env.DEV && (
                <div className="flex gap-2">
                  <DummyDataControls
                    onAddDummyData={handleAddDummyData}
                    onRemoveDummyData={handleRemoveDummyData}
                  />
                  <button
                    onClick={handleClearViewedAlerts}
                    className="px-3 py-1 text-xs bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors"
                    title="Clear viewed alerts (dev only)"
                  >
                    Clear Alerts
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Empty State - Show when no transactions this month */}
          {dashboardMonthTransactions.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border-2 border-dashed border-purple-300 dark:border-purple-600 p-12 text-center">
              <div className="max-w-md mx-auto">
                <div className="w-20 h-20 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-10 h-10 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
                  Welcome to {dashboardMonthDate.toLocaleDateString(getUserLocale(), { month: 'long', year: 'numeric' })}!
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-8 text-lg">
                  Start tracking your finances by adding your first transaction.
                </p>
                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center justify-center gap-2">
                    <span>💡</span>
                    <span>Tip: Start by recording your salary or main income for the month</span>
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* BUDGET PERFORMANCE - Unified Widget */}
              <div className="mb-8">
                {/* Mobile Sticky Header */}
                <div className="md:hidden sticky top-0 z-10 bg-purple-100 dark:bg-purple-950/30 -mx-3 px-3 py-3 mb-4 border-b-2 border-purple-300 dark:border-purple-700">
                  <h2 className="text-lg font-semibold text-purple-900 dark:text-purple-100">
                    Budget Performance{showBreakdownInHeader && ' | Breakdown'}
                  </h2>
                </div>
                
                {/* Desktop version - compact grid layout */}
                <div className="max-md:hidden">
                  <BudgetPerformanceCard 
                    selectedMonth={dashboardMonthDate} 
                    isCompact={true} 
                    themeColor="purple"
                    onAlertsViewed={handleAlertsViewed}
                    onCategoryClick={handleCategoryClick}
                  />
                </div>
                
                {/* Mobile/Tablet version - full layout with breakdown observer */}
                <div className="md:hidden">
                  <BudgetPerformanceCard 
                    selectedMonth={dashboardMonthDate} 
                    isCompact={false} 
                    themeColor="purple"
                    onBreakdownVisible={handleBreakdownVisible}
                    onAlertsViewed={handleAlertsViewed}
                    onCategoryClick={handleCategoryClick}
                  />
                </div>
              </div>

              {/* 2. BUDGET CATEGORY BREAKDOWN - Second Priority */}
              <div ref={expenseChartRef} className="mb-8">
                {/* Mobile Sticky Header */}
                <div className="md:hidden sticky top-0 z-10 bg-purple-100 dark:bg-purple-950/30 -mx-3 px-3 py-3 mb-4 border-b-2 border-purple-300 dark:border-purple-700">
                  <h2 className="text-lg font-semibold text-purple-900 dark:text-purple-100">Expenses by Category</h2>
                </div>
                
                <ExpenseChart
                  categoryData={dashboardCategoryData}
                  transactions={dashboardMonthTransactions}
                  personalBudget={personalBudget}
                  formatCurrency={formatCurrency}
                  selectedCategory={selectedDesktopCategory}
                  onEditTransaction={setViewingTransactionDetails}
                  onViewAllTransactions={(category) => {
                    setSelectedDesktopCategory(category);
                    setIsCategoryModalOpen(true);
                  }}
                />
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'transactions' && (
        <Transactions />
      )}

      {activeTab === 'budget' && (
        <div>
          <BudgetManagement />
        </div>
      )}

      {activeTab === 'insights' && (
        <div>
          <InsightsPage />
        </div>
      )}

      {/* Edit Transaction Modal */}
      {editingTransaction && (
        <EditTransactionModal
          transaction={editingTransaction}
          onClose={() => setEditingTransaction(null)}
        />
      )}

      {/* Household Settings Modal */}
      <HouseholdSettingsModal
        isOpen={isHouseholdSettingsModalOpen}
        onClose={() => setIsHouseholdSettingsModalOpen(false)}
      />

      {/* Category Expenses Modal */}
      <CategoryTransactionsModal
        isOpen={isCategoryModalOpen && selectedDesktopCategory !== null}
        category={selectedDesktopCategory || ''}
        categories={dashboardCategoryData.map(c => c.category).sort()}
        transactions={dashboardMonthTransactions
          .filter(t => t.type === 'expense' && t.category === selectedDesktopCategory)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())}
        formatCurrency={formatCurrency}
        getFamilyMemberName={getFamilyMemberName}
        onClose={() => {
          setIsCategoryModalOpen(false);
          setSelectedDesktopCategory(null);
        }}
        onEditTransaction={setViewingTransactionDetails}
        onCategoryChange={(category) => {
          setSelectedDesktopCategory(category);
        }}
        onViewInTransactions={(category) => {
          // Navigate to Transactions tab
          // TODO: Support passing category filter to Transactions page via URL params
          setActiveTab('transactions');
          setSearchParams({ tab: 'transactions' });
        }}
      />

      {/* Custom Date Range Modal */}
      <CustomDateRangeModal
        isOpen={isCustomDateRangeModalOpen}
        onClose={() => setIsCustomDateRangeModalOpen(false)}
      />

      {/* Transaction Details Modal */}
      <TransactionDetailsModal
        transaction={viewingTransactionDetails}
        isOpen={viewingTransactionDetails !== null}
        onClose={() => setViewingTransactionDetails(null)}
        formatCurrency={formatCurrency}
        familyMembers={familyMembers}
      />
      </div>
      
      {/* Production: Show inline BuildInfo at bottom of page */}
      {!import.meta.env.DEV && <BuildInfo inline />}
    </div>
  );
};

export default Dashboard;
