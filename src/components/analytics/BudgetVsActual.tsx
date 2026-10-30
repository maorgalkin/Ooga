import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, useMotionValue, useAnimate } from 'framer-motion';
import { useFinance } from '../../context/FinanceContext';
import { useActiveBudget, useMonthlyBudgetsForDateRange } from '../../hooks/useBudgets';
import { filterTransactionsByDateRange, getDateRange } from '../../utils/dateRangeFilters';
import type { DateRangeType } from '../../utils/dateRangeFilters';
import { AlertTriangle, TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';
import { formatCurrencyFromSettings, formatCurrencyRounded as formatCurrencyRoundedUtil } from '../../utils/formatCurrency';

interface BudgetVsActualProps {
  /** The selected date range type */
  selectedRange: DateRangeType;
  /** Show only the summary cards (no chart) */
  showSummaryOnly?: boolean;
  /** Show only the chart (no header or summary) */
  showChartOnly?: boolean;
}

const CATEGORY_WIDTH_DESKTOP = 100; // Width of each category column on desktop
const CATEGORY_WIDTH_MOBILE = 70; // Width of each category column on mobile
const CATEGORY_GAP_DESKTOP = 16; // Gap between categories on desktop
const CATEGORY_GAP_MOBILE = 8; // Gap between categories on mobile (tighter)
const BAR_WIDTH_DESKTOP = 80; // Width of individual bars on desktop
const BAR_WIDTH_MOBILE = 50; // Width of individual bars on mobile (thinner)
const BAR_OVERLAP = 30; // Reduced from 85% for better clarity

export const BudgetVsActual: React.FC<BudgetVsActualProps> = ({ selectedRange, showSummaryOnly = false, showChartOnly = false }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [categoriesPerView, setCategoriesPerView] = useState(8);
  const [barWidth, setBarWidth] = useState(BAR_WIDTH_DESKTOP);
  const [categoryWidth, setCategoryWidth] = useState(CATEGORY_WIDTH_DESKTOP);
  const [categoryGap, setCategoryGap] = useState(CATEGORY_GAP_DESKTOP);
  const [scope, animate] = useAnimate();
  const dragX = useMotionValue(0);
  
  const { transactions } = useFinance();
  const { data: personalBudget, isLoading: loadingPersonal } = useActiveBudget();
  
  const dateRangeData = useMemo(() => getDateRange(selectedRange), [selectedRange]);
  const { startDate, endDate } = dateRangeData;
  
  const { data: monthlyBudgets, isLoading: loadingMonthly } = useMonthlyBudgetsForDateRange(startDate, endDate);

  const filteredTransactions = useMemo(() => {
    return filterTransactionsByDateRange(transactions, selectedRange);
  }, [transactions, selectedRange]);

  const categoryData = useMemo(() => {
    if (!personalBudget || !monthlyBudgets) return [];

    const data: {
      category: string;
      originalBudget: number;
      currentBudget: number;
      actualSpending: number;
      color: string;
      monthsWithBudget: number;
    }[] = [];

    // Get all active categories
    const activeCategories = Object.keys(personalBudget.categories).filter(
      cat => personalBudget.categories[cat].isActive
    );

    activeCategories.forEach(categoryName => {
      const personalConfig = personalBudget.categories[categoryName];

      // Count months and calculate sums (skip months with zero budget)
      let originalSum = 0;
      let currentSum = 0;
      let monthsWithOriginal = 0;
      let monthsWithCurrent = 0;

      monthlyBudgets.forEach(mb => {
        // Original budget from original_categories (month-start snapshot)
        const originalConfig = mb.original_categories?.[categoryName];
        const originalLimit = originalConfig?.monthlyLimit || 0;
        if (originalLimit > 0) {
          originalSum += originalLimit;
          monthsWithOriginal++;
        }

        // Current budget from categories (includes edits)
        const monthlyConfig = mb.categories[categoryName];
        const currentLimit = monthlyConfig?.monthlyLimit || 0;
        if (currentLimit > 0) {
          currentSum += currentLimit;
          monthsWithCurrent++;
        }
      });

      // Calculate averages (avoid division by zero)
      const originalBudget = monthsWithOriginal > 0 ? originalSum / monthsWithOriginal : 0;
      const currentBudget = monthsWithCurrent > 0 ? currentSum / monthsWithCurrent : 0;
      const monthsWithBudget = Math.max(monthsWithOriginal, monthsWithCurrent);

      // Actual spending (from filtered transactions)
      const actualSpending = filteredTransactions
        .filter(t => t.type === 'expense' && t.category === categoryName)
        .reduce((sum, t) => sum + t.amount, 0);

      data.push({
        category: categoryName,
        originalBudget,
        currentBudget,
        actualSpending,
        color: personalConfig.color || '#3B82F6',
        monthsWithBudget,
      });
    });

    // Sort by actual spending (highest first)
    return data.sort((a, b) => b.actualSpending - a.actualSpending);
  }, [personalBudget, monthlyBudgets, filteredTransactions]);

  // Calculate categories per view and bar width based on container width
  useEffect(() => {
    const updateLayout = () => {
      if (containerRef.current) {
        // Determine if mobile based on window width
        const isMobile = window.innerWidth < 768;
        
        // Set responsive dimensions
        const currentCategoryWidth = isMobile ? CATEGORY_WIDTH_MOBILE : CATEGORY_WIDTH_DESKTOP;
        const currentCategoryGap = isMobile ? CATEGORY_GAP_MOBILE : CATEGORY_GAP_DESKTOP;
        const currentBarWidth = isMobile ? BAR_WIDTH_MOBILE : BAR_WIDTH_DESKTOP;
        
        setCategoryWidth(currentCategoryWidth);
        setCategoryGap(currentCategoryGap);
        setBarWidth(currentBarWidth);
        
        // Calculate how many categories fit
        const containerWidth = containerRef.current.offsetWidth;
        const categoriesPerView = Math.floor(containerWidth / (currentCategoryWidth + currentCategoryGap));
        setCategoriesPerView(Math.max(3, categoriesPerView)); // Minimum 3 categories
      }
    };

    updateLayout();
    window.addEventListener('resize', updateLayout);
    return () => window.removeEventListener('resize', updateLayout);
  }, []);

  const summary = useMemo(() => {
    return categoryData.reduce(
      (acc, cat) => ({
        totalOriginal: acc.totalOriginal + cat.originalBudget,
        totalCurrent: acc.totalCurrent + cat.currentBudget,
        totalSpent: acc.totalSpent + cat.actualSpending,
      }),
      { totalOriginal: 0, totalCurrent: 0, totalSpent: 0 }
    );
  }, [categoryData]);

  const formatCurrency = (amount: number) => {
    return formatCurrencyFromSettings(amount, personalBudget?.global_settings);
  };

  const formatCurrencyRounded = (amount: number) => {
    const currency = personalBudget?.global_settings?.currency || 'USD';
    const showRounded = personalBudget?.global_settings?.showRoundedAmounts ?? true;
    return formatCurrencyRoundedUtil(amount, currency, showRounded);
  };

  const getUtilizationColor = (spent: number, budget: number) => {
    if (budget === 0) return 'text-gray-500';
    const percentage = (spent / budget) * 100;
    if (percentage > 100) return 'text-red-600 dark:text-red-400';
    if (percentage > 80) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-green-600 dark:text-green-400';
  };

  const getUtilizationIcon = (spent: number, budget: number) => {
    if (budget === 0) return <Minus className="h-4 w-4" />;
    const percentage = (spent / budget) * 100;
    if (percentage > 100) return <AlertTriangle className="h-4 w-4" />;
    if (percentage > 80) return <TrendingUp className="h-4 w-4" />;
    return <TrendingDown className="h-4 w-4" />;
  };

  if (loadingPersonal || loadingMonthly) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-3 text-gray-600 dark:text-gray-300">Loading budget data...</span>
      </div>
    );
  }

  if (!personalBudget) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
        <p className="text-gray-600 dark:text-gray-400">
          No personal budget configured. Please set up your budget first.
        </p>
      </div>
    );
  }

  if (!monthlyBudgets || monthlyBudgets.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
        <p className="text-gray-600 dark:text-gray-400">
          Creating monthly budgets for the selected period...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header - only show when not using split mode */}
      {!showSummaryOnly && !showChartOnly && (
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Budget vs actual
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Compare budgeted amounts with actual spending across categories
          </p>
        </div>
      )}

      {/* Summary Cards - show when not chart-only */}
      {!showChartOnly && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
              Avg original budget
            </p>
            <p className="text-2xl font-bold text-blue-900 dark:text-blue-400">
              {formatCurrency(summary.totalOriginal)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Average planned at month start
            </p>
          </div>

          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
              Avg current budget
            </p>
            <p className="text-2xl font-bold text-purple-900 dark:text-purple-400">
              {formatCurrency(summary.totalCurrent)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {summary.totalCurrent !== summary.totalOriginal
                ? `Avg adjusted ${summary.totalCurrent > summary.totalOriginal ? '+' : ''}${formatCurrency(summary.totalCurrent - summary.totalOriginal)}`
                : 'No adjustments on average'}
            </p>
          </div>

          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
              Total spending
            </p>
            <p className="text-2xl font-bold text-orange-900 dark:text-orange-400">
              {formatCurrency(summary.totalSpent)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {summary.totalCurrent > 0
                ? `${((summary.totalSpent / summary.totalCurrent) * 100).toFixed(1)}% of avg budget`
                : 'No budget set'}
            </p>
          </div>
        </div>
      )}

      {/* Category Breakdown - Column Chart - show when not summary-only */}
      {!showSummaryOnly && (
        <div className={showChartOnly ? "" : "bg-white dark:bg-gray-800 rounded-lg shadow-md p-6"}>
          {!showChartOnly && (
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">
              Category breakdown
            </h3>
          )}

        {categoryData.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-8">
            No budget categories configured
          </p>
        ) : (
          <>
            {/* Legend */}
            <div className="flex flex-wrap gap-4 mb-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-gray-400 dark:bg-gray-600" />
                <span className="text-gray-700 dark:text-gray-300">Original budget</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-blue-400 dark:bg-blue-600" />
                <span className="text-gray-700 dark:text-gray-300">Current budget</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-4 h-4 rounded bg-green-400 dark:bg-green-600" />
                  <div className="w-4 h-4 rounded bg-yellow-400 dark:bg-yellow-600" />
                  <div className="w-4 h-4 rounded bg-red-400 dark:bg-red-600" />
                </div>
                <span className="text-gray-700 dark:text-gray-300">Actual spending (good / warning / over)</span>
              </div>
            </div>

            {/* Column Chart with Y-Axis - Drag Scrollable */}
            <div className="flex gap-2">
              {/* Y-Axis */}
              <div className="relative text-xs text-gray-500 dark:text-gray-400" style={{ height: '480px', width: '60px' }}>
                {(() => {
                  const maxVal = Math.max(...categoryData.map(c => Math.max(c.originalBudget, c.currentBudget, c.actualSpending)));
                  
                  // Calculate logarithmic midpoint value
                  // If visual middle is 50% on log scale: log(1 + midVal) / log(1 + maxVal) = 0.5
                  // Therefore: log(1 + midVal) = 0.5 * log(1 + maxVal)
                  // midVal = 10^(0.5 * log10(1 + maxVal)) - 1
                  const logMidVal = Math.pow(10, 0.5 * Math.log10(1 + maxVal)) - 1;
                  
                  return (
                    <>
                      {/* Max - aligned with top of bars */}
                      <div className="absolute top-0 right-0 flex flex-col items-end pr-2">
                        <div className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          <span className="font-medium">{formatCurrencyRounded(maxVal)}</span>
                        </div>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500">Max</span>
                      </div>
                      
                      {/* Mid - at visual middle of bar area (175px from top) */}
                      <div className="absolute right-0 flex flex-col items-end pr-2" style={{ top: '175px' }}>
                        <span className="font-medium">{formatCurrencyRounded(logMidVal)}</span>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500">Mid</span>
                      </div>
                      
                      {/* Min - aligned with bottom of bars (350px from top) */}
                      <div className="absolute right-0 flex flex-col items-end pr-2" style={{ top: '350px' }}>
                        <span className="font-medium">{formatCurrencyRounded(0)}</span>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500">Min</span>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Chart Container */}
              <div 
                ref={containerRef} 
                className="relative overflow-hidden flex-1"
                style={{ height: '480px', touchAction: 'pan-y pinch-zoom' }}
              >
              <motion.div
                ref={scope}
                drag="x"
                dragConstraints={{
                  left: Math.min(0, -(categoryData.length - categoriesPerView) * (categoryWidth + categoryGap)),
                  right: 0
                }}
                dragElastic={0.1}
                dragMomentum={false}
                style={{ x: dragX, paddingLeft: '8px', paddingRight: '8px' }}
                onDragEnd={() => {
                  // Snap to nearest category
                  const categoryStep = categoryWidth + categoryGap;
                  const currentX = dragX.get();
                  const snappedIndex = Math.round(-currentX / categoryStep);
                  const snappedX = -snappedIndex * categoryStep;
                  
                  // Animate to snapped position
                  animate(scope.current, { x: snappedX }, { type: 'spring', stiffness: 300, damping: 30 });
                }}
                className="flex items-end h-full cursor-grab active:cursor-grabbing"
              >
                {(() => {
                  // Calculate max value once for normalization
                  const maxValue = Math.max(
                    ...categoryData.map(c => Math.max(c.originalBudget, c.currentBudget, c.actualSpending)),
                    1 // Ensure at least 1 to avoid division by zero
                  );

                  // Logarithmic scale helper function
                  // This compresses large values and expands small values for better visualization
                  const getLogScaledHeight = (value: number, max: number): number => {
                    if (value === 0 || max === 0) return 0;
                    
                    // Use log scale: log(1 + value) / log(1 + max)
                    // The +1 ensures log(0) doesn't occur
                    const logValue = Math.log10(1 + value);
                    const logMax = Math.log10(1 + max);
                    
                    return (logValue / logMax) * 100;
                  };

                  return categoryData.map((cat) => {
                    // Calculate heights using logarithmic scale for better visual balance
                    const originalHeight = getLogScaledHeight(cat.originalBudget, maxValue);
                    const currentHeight = getLogScaledHeight(cat.currentBudget, maxValue);
                    const actualHeight = getLogScaledHeight(cat.actualSpending, maxValue);
                    
                    const utilizationPercent = cat.currentBudget > 0 
                      ? (cat.actualSpending / cat.currentBudget) * 100 
                      : 0;

                    // Determine actual spending color based on comparison to current budget
                    const actualColor = cat.actualSpending > cat.currentBudget
                      ? 'bg-red-400 dark:bg-red-600'
                      : utilizationPercent > 80
                      ? 'bg-yellow-400 dark:bg-yellow-600'
                      : 'bg-green-400 dark:bg-green-600';

                    // Truncate category name if too long
                    const displayName = cat.category.length > 18 
                      ? cat.category.substring(0, 18) + '...' 
                      : cat.category;

                    const visibleWidth = barWidth * (BAR_OVERLAP / 100);
                    const totalBarWidth = barWidth + visibleWidth * 2;

                    return (
                      <div 
                        key={cat.category} 
                        className="relative flex flex-col items-center flex-shrink-0"
                        style={{ 
                          width: `${categoryWidth}px`,
                          marginRight: `${categoryGap}px`
                        }}
                      >
                        {/* Invisible drag overlay - covers full height */}
                        <div 
                          className="absolute inset-0 z-10"
                          style={{ width: '100%', height: '100%' }}
                        />
                        
                        {/* Bar Container with 3 overlapping bars */}
                        <div 
                          className="relative flex items-end pointer-events-none" 
                          style={{ 
                            height: '350px', 
                            width: `${totalBarWidth}px`
                          }}
                        >
                          {/* Original Budget (Gray) - leftmost */}
                          <div
                            className="absolute bottom-0 left-0 bg-gray-400 dark:bg-gray-600 rounded-t transition-all duration-500 shadow-md border-r border-gray-500 dark:border-gray-700 pointer-events-none"
                            style={{ 
                              height: `${originalHeight}%`, 
                              minHeight: cat.originalBudget > 0 ? '4px' : '0',
                              width: `${barWidth}px`,
                              zIndex: 1
                            }}
                            title={`${cat.category} - Original: ${formatCurrency(cat.originalBudget)}`}
                          />

                          {/* Current Budget (Blue) - middle, overlaps gray */}
                          <div
                            className="absolute bottom-0 bg-blue-400 dark:bg-blue-600 rounded-t transition-all duration-500 shadow-md border-r border-blue-500 dark:border-blue-700 pointer-events-none"
                            style={{ 
                              height: `${currentHeight}%`, 
                              minHeight: cat.currentBudget > 0 ? '4px' : '0',
                              width: `${barWidth}px`,
                              left: `${visibleWidth}px`,
                              zIndex: 2
                            }}
                            title={`${cat.category} - Current: ${formatCurrency(cat.currentBudget)}`}
                          />

                          {/* Actual Spending (Green/Yellow/Red) - rightmost */}
                          <div
                            className={`absolute bottom-0 rounded-t transition-all duration-500 shadow-md pointer-events-none ${actualColor}`}
                            style={{ 
                              height: `${actualHeight}%`, 
                              minHeight: cat.actualSpending > 0 ? '4px' : '0',
                              width: `${barWidth}px`,
                              left: `${visibleWidth * 2}px`,
                              zIndex: 3
                            }}
                            title={`${cat.category} - Actual: ${formatCurrency(cat.actualSpending)}`}
                          />
                        </div>

                        {/* Category Name (Diagonal) and Utilization */}
                        <div className="flex flex-col items-center pointer-events-none" style={{ height: '100px', width: '40px' }}>
                          {/* Diagonal Label */}
                          <div className="relative" style={{ height: '80px', width: '40px' }}>
                            <div
                              className="absolute bottom-0 left-1/2 origin-bottom-left whitespace-nowrap"
                              style={{ 
                                transform: 'translateX(-50%) rotate(-45deg)',
                              }}
                            >
                              <div className="flex items-center gap-1">
                                <div
                                  className="w-2 h-2 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: cat.color }}
                                />
                                <span 
                                  className="text-xs font-medium text-gray-900 dark:text-gray-100"
                                  title={cat.category}
                                >
                                  {displayName}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Utilization */}
                          <div className={`flex items-center justify-center gap-0.5 text-[10px] font-medium mt-1 ${getUtilizationColor(cat.actualSpending, cat.currentBudget)}`}>
                            <span className="scale-75">{getUtilizationIcon(cat.actualSpending, cat.currentBudget)}</span>
                            <span>{utilizationPercent.toFixed(0)}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </motion.div>
            </div>
            </div>

            {/* Scale Note */}
            <div className="flex items-center gap-2 mt-2 text-xs italic text-gray-500 dark:text-gray-400">
              <TrendingUp className="h-3 w-3" />
              <span>Logarithmic scale for better visibility</span>
            </div>
          </>
        )}
      </div>
      )}
    </div>
  );
};
