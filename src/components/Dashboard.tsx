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
import { DashboardEmptyState } from './dashboard/DashboardEmptyState';
import { DashboardTileLayout } from './dashboard/DashboardTileLayout';
import { ProjectedMonthView } from './dashboard/ProjectedMonthView';
import {
  DESKTOP_MEDIA_QUERY,
  SHOW_LAYOUT_PICKER,
  initialLayoutMode,
  resolveLayout,
  type LayoutMode,
} from './dashboard/layoutMode';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { ExpenseChart } from './dashboard/ExpenseChart';
import { formatCurrencyFromSettings } from '../utils/formatCurrency';
import { DummyDataControls } from './dashboard/DummyDataControls';
import { CategoryTransactionsModal } from './dashboard/CategoryTransactionsModal';
import { Transactions } from '../pages/Transactions';
import { BuildInfo } from './BuildInfo';
import CustomDateRangeModal from './CustomDateRangeModal';
import * as HouseholdService from '../services/householdService';
import type { Transaction, BudgetConfiguration } from '../types';
import type { Household } from '../services/householdService';
import { getHeadingColor, getSubheadingColor } from '../utils/themeColors';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getMonthsWithData, getMonthStart, toMonthKey, parseMonthKey } from '../utils/dateHelpers';
import { getProjectedBankInstallments, getLastCommittedMonth } from '../utils/projections';


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
  // Production: tiled on desktop, wide (legacy) on phones. The picker only exists in development.
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(() => {
    try {
      return initialLayoutMode(localStorage.getItem('dashboard-layout'));
    } catch {
      return 'auto';
    }
  });
  const isDesktop = useMediaQuery(DESKTOP_MEDIA_QUERY);
  const layout = resolveLayout(layoutMode, isDesktop);
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

  // Dashboard month: from ?month=YYYY-MM, defaulting to the current calendar month.
  // Navigable range is the oldest month with data up to the last month with a committed charge;
  // months after the current one show a projection of those committed charges.
  const currentMonthStart = getMonthStart(new Date());
  const currentMonthTime = currentMonthStart.getTime();
  const oldestMonthStart = useMemo(() => {
    const months = getMonthsWithData(transactions);
    const oldest = months[months.length - 1].start;
    return oldest.getTime() < currentMonthTime ? oldest : new Date(currentMonthTime);
  }, [transactions, currentMonthTime]);
  // Committed future charges: in-app installment plans already have a row per month;
  // bank installments are projected from their latest imported charge
  const projectedTransactions = useMemo(() => getProjectedBankInstallments(transactions), [transactions]);
  const lastCommittedMonthStart = useMemo(
    () => getLastCommittedMonth([...transactions, ...projectedTransactions]),
    [transactions, projectedTransactions]
  );
  const requestedMonth = parseMonthKey(searchParams.get('month'));
  const dashboardMonth = !requestedMonth
    ? currentMonthStart
    : requestedMonth > lastCommittedMonthStart ? lastCommittedMonthStart
    : requestedMonth < oldestMonthStart ? oldestMonthStart : requestedMonth;
  const isViewingCurrentMonth = dashboardMonth.getTime() === currentMonthStart.getTime();
  const isProjectedMonth = dashboardMonth > currentMonthStart;
  const canGoToPrevMonth = dashboardMonth > oldestMonthStart;
  const canGoToNextMonth = dashboardMonth < lastCommittedMonthStart;
  const dashboardTransactions = useMemo(
    () => isProjectedMonth ? [...transactions, ...projectedTransactions] : transactions,
    [isProjectedMonth, transactions, projectedTransactions]
  );

  const setDashboardMonth = (month: Date) => {
    const newParams = new URLSearchParams(searchParams);
    if (month.getTime() === currentMonthStart.getTime()) {
      newParams.delete('month'); // Clean URL for the current month
    } else {
      newParams.set('month', toMonthKey(month));
    }
    setSearchParams(newParams);
  };
  const shiftDashboardMonth = (delta: number) => {
    setDashboardMonth(new Date(dashboardMonth.getFullYear(), dashboardMonth.getMonth() + delta, 1));
  };

  // Use custom hook for data management
  // Dashboard tab shows a single month (dashboardMonth), Transactions tab uses its own carousel
  const {
    monthTransactions: dashboardMonthTransactions,
    monthCategoryData: dashboardCategoryData,
    selectedMonthDate: dashboardMonthDate,
    getFamilyMemberName,
  } = useDashboardData({
    transactions: dashboardTransactions,
    familyMembers,
    budgetConfig: null,
    activeMonthIndex: null, // Always null for Dashboard - single month mode
    dashboardMonth,
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
                <div className="flex items-center gap-1 mb-1 -ml-2">
                  <button
                    onClick={() => shiftDashboardMonth(-1)}
                    disabled={!canGoToPrevMonth}
                    aria-label="Previous month"
                    className="p-1 rounded-full text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                  <h1 className={`text-3xl font-bold ${getHeadingColor('purple')}`}>
                    {dashboardMonthDate.toLocaleDateString(getUserLocale(), { month: 'long' })} '{String(dashboardMonthDate.getFullYear()).slice(2)} Dashboard
                  </h1>
                  <button
                    onClick={() => shiftDashboardMonth(1)}
                    disabled={!canGoToNextMonth}
                    aria-label="Next month"
                    className="p-1 rounded-full text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </button>
                  {isProjectedMonth && (
                    <span className="ml-1 px-2 py-0.5 text-xs font-medium rounded-full border border-dashed border-purple-400 text-purple-700 dark:text-purple-300">
                      Projected
                    </span>
                  )}
                  {!isViewingCurrentMonth && (
                    <button
                      onClick={() => setDashboardMonth(currentMonthStart)}
                      className="ml-2 px-2.5 py-0.5 text-xs font-medium rounded-full bg-purple-600 text-white hover:bg-purple-700 transition-colors"
                    >
                      Today
                    </button>
                  )}
                </div>
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

          {/* Future month: committed charges only. Otherwise the empty state when there are no transactions */}
          {isProjectedMonth ? (
            <ProjectedMonthView
              monthDate={dashboardMonthDate}
              transactions={dashboardMonthTransactions}
              personalBudget={personalBudget}
              formatCurrency={formatCurrency}
              onViewTransaction={setViewingTransactionDetails}
            />
          ) : dashboardMonthTransactions.length === 0 ? (
            <DashboardEmptyState
              monthDate={isViewingCurrentMonth ? new Date() : dashboardMonthDate}
              isPastMonth={!isViewingCurrentMonth}
              allTransactions={transactions}
              personalBudget={personalBudget}
              formatCurrency={formatCurrency}
              householdName={household?.name}
            />
          ) : (
            <>
              {/* Layout toggle — development only (production is always 'auto') */}
              {SHOW_LAYOUT_PICKER && (
                <div className="flex items-center justify-end mb-4 gap-1">
                  <span className="text-xs text-gray-400 mr-2">Layout:</span>
                  {(
                    [
                      { id: 'auto', label: 'Auto (prod)' },
                      { id: 'wide', label: 'Wide' },
                      { id: 'both', label: 'Both' },
                      { id: 'tiled', label: 'Tiled' },
                    ] as const
                  ).map(({ id, label }) => (
                    <button
                      key={id}
                      onClick={() => {
                        setLayoutMode(id);
                        try { localStorage.setItem('dashboard-layout', id); } catch { /* per-viewer convenience only */ }
                      }}
                      className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                        layoutMode === id
                          ? 'bg-purple-100 dark:bg-purple-900/40 border-purple-300 dark:border-purple-600 text-purple-700 dark:text-purple-300 font-medium'
                          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {/* WIDE layout */}
              {(layout === 'wide' || layout === 'both') && (
                <div>
                  {layout === 'both' && (
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                      Layout A — Wide
                    </p>
                  )}

                  {/* Mobile Sticky Header */}
                  <div className="md:hidden sticky top-0 z-10 bg-purple-100 dark:bg-purple-950/30 -mx-3 px-3 py-3 mb-4 border-b-2 border-purple-300 dark:border-purple-700">
                    <h2 className="text-lg font-semibold text-purple-900 dark:text-purple-100">
                      Budget Performance{showBreakdownInHeader && ' | Breakdown'}
                    </h2>
                  </div>

                  {/* Single BudgetPerformanceCard — always expanded (isCompact=false) */}
                  <div className="mb-8">
                    <BudgetPerformanceCard
                      selectedMonth={dashboardMonthDate}
                      isCompact={false}
                      themeColor="purple"
                      onBreakdownVisible={handleBreakdownVisible}
                      onAlertsViewed={handleAlertsViewed}
                      onCategoryClick={handleCategoryClick}
                    />
                  </div>

                  {/* Budget Category Breakdown */}
                  <div ref={expenseChartRef} className="mb-8">
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
                </div>
              )}

              {/* Divider between layouts in "both" mode */}
              {layout === 'both' && (
                <div className="relative my-8">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t-2 border-dashed border-gray-300 dark:border-gray-600" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-purple-50 dark:bg-purple-950/30 px-4 py-1 text-xs font-semibold text-gray-400 uppercase tracking-widest rounded-full border border-gray-300 dark:border-gray-600">
                      vs
                    </span>
                  </div>
                </div>
              )}

              {/* TILED layout */}
              {(layout === 'tiled' || layout === 'both') && (
                <div>
                  {layout === 'both' && (
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                      Layout B — Tiled
                    </p>
                  )}
                  <DashboardTileLayout
                    monthDate={dashboardMonthDate}
                    transactions={dashboardMonthTransactions}
                    categoryData={dashboardCategoryData}
                    personalBudget={personalBudget}
                    formatCurrency={formatCurrency}
                    onCategoryClick={handleCategoryClick}
                    onEditTransaction={setViewingTransactionDetails}
                    onViewAllTransactions={(category) => {
                      setSelectedDesktopCategory(category);
                      setIsCategoryModalOpen(true);
                    }}
                    selectedCategory={selectedDesktopCategory}
                  />
                </div>
              )}
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
