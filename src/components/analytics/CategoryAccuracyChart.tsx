import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { AccuracyTarget } from './AccuracyTarget';
import { categoryAccuracyService } from '../../services/categoryAccuracyService';
import type { CategoryAccuracy } from '../../types/analytics';
import type { Transaction } from '../../types';
import type { PersonalBudget } from '../../types/budget';
import type { DateRangeType } from '../../utils/dateRangeFilters';
import { getDateRange } from '../../utils/dateRangeFilters';
import { getUserLocale } from '../../utils/locale';
import { formatCurrencyFromSettings } from '../../utils/formatCurrency';

interface CategoryAccuracyChartProps {
  transactions: Transaction[];
  personalBudget: PersonalBudget | null | undefined;
  selectedRange: DateRangeType;
  onScrollToDateRange?: () => void;
}

// Get background/border color classes based on accuracy percentage
// Under budget scale: 0=gray, <50%=purple, 50-74%=blue, 75-89%=teal, 90-94%=emerald, 95-105%=green
// Over budget scale: 106-120%=yellow, 121-140%=orange, >140%=red
const getAccuracyColors = (accuracy: CategoryAccuracy) => {
  const pct = accuracy.accuracyPercentage;
  
  // Zero/unused - Gray
  if (accuracy.isUnused || pct === 0) {
    return {
      bg: 'bg-gray-50 dark:bg-gray-800/50',
      border: 'border-gray-300 dark:border-gray-600',
      text: 'text-gray-600 dark:text-gray-400',
      badge: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
    };
  }
  
  // Perfect (95-105%) - Green
  if (pct >= 95 && pct <= 105) {
    return {
      bg: 'bg-green-50 dark:bg-green-900/20',
      border: 'border-green-400 dark:border-green-600',
      text: 'text-green-600 dark:text-green-400',
      badge: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
    };
  }
  
  // === OVER BUDGET (red hues) ===
  
  // Slightly over (106-120%) - Yellow
  if (pct > 105 && pct <= 120) {
    return {
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      border: 'border-yellow-400 dark:border-yellow-600',
      text: 'text-yellow-600 dark:text-yellow-400',
      badge: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300'
    };
  }
  
  // Moderately over (121-140%) - Orange
  if (pct > 120 && pct <= 140) {
    return {
      bg: 'bg-orange-50 dark:bg-orange-900/20',
      border: 'border-orange-400 dark:border-orange-600',
      text: 'text-orange-600 dark:text-orange-400',
      badge: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300'
    };
  }
  
  // Significantly over (>140%) - Red
  if (pct > 140) {
    return {
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-400 dark:border-red-600',
      text: 'text-red-600 dark:text-red-400',
      badge: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
    };
  }
  
  // === UNDER BUDGET (cool hues) ===
  
  // Near perfect (90-94%) - Bluish-green/Emerald
  if (pct >= 90 && pct < 95) {
    return {
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      border: 'border-emerald-400 dark:border-emerald-600',
      text: 'text-emerald-600 dark:text-emerald-400',
      badge: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
    };
  }
  
  // Good (75-89%) - Teal
  if (pct >= 75 && pct < 90) {
    return {
      bg: 'bg-teal-50 dark:bg-teal-900/20',
      border: 'border-teal-400 dark:border-teal-600',
      text: 'text-teal-600 dark:text-teal-400',
      badge: 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300'
    };
  }
  
  // Moderate under (50-74%) - Deep Blue
  if (pct >= 50 && pct < 75) {
    return {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      border: 'border-blue-400 dark:border-blue-600',
      text: 'text-blue-600 dark:text-blue-400',
      badge: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
    };
  }
  
  // Significantly under (<50%) - Purple
  return {
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    border: 'border-purple-400 dark:border-purple-600',
    text: 'text-purple-600 dark:text-purple-400',
    badge: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
  };
};

/**
 * Main container for Category Accuracy analysis
 * Displays bullseye targets showing how accurately each category was budgeted
 */
export const CategoryAccuracyChart: React.FC<CategoryAccuracyChartProps> = ({
  transactions,
  personalBudget,
  selectedRange,
  onScrollToDateRange,
}) => {
  const [accuracyData, setAccuracyData] = useState<CategoryAccuracy[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Calculate date range based on selection
  const dateRange = useMemo(() => {
    return getDateRange(selectedRange);
  }, [selectedRange]);

  // Calculate accuracy data when range or budget changes
  useEffect(() => {
    const calculateAccuracy = async () => {
      if (!personalBudget) {
        setAccuracyData([]);
        setSelectedCategory('');
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const data = await categoryAccuracyService.calculateCategoryAccuracy(
          transactions,
          personalBudget,
          dateRange.startDate,
          dateRange.endDate
        );
        setAccuracyData(data);
        
        // Auto-select first category if none selected
        if (!selectedCategory && data.length > 0) {
          setSelectedCategory(data[0].category);
        }
      } catch (err) {
        console.error('Error calculating category accuracy:', err);
        setError('Failed to calculate accuracy data. Please try again.');
        setAccuracyData([]);
      } finally {
        setIsLoading(false);
      }
    };

    calculateAccuracy();
  }, [transactions, personalBudget, dateRange.startDate, dateRange.endDate]);
  
  // Get the selected category's accuracy data
  const selectedAccuracy = useMemo(() => {
    return accuracyData.find(a => a.category === selectedCategory);
  }, [accuracyData, selectedCategory]);

  // Get date range info for display
  const dateRangeInfo = useMemo(() => getDateRange(selectedRange), [selectedRange]);
  
  // Get colors based on accuracy
  const colors = useMemo(() => {
    if (!selectedAccuracy) return null;
    return getAccuracyColors(selectedAccuracy);
  }, [selectedAccuracy]);

  // Handle touch toggle for mobile
  const handleContainerClick = (e: React.MouseEvent | React.TouchEvent) => {
    // Don't toggle if clicking on dropdown or its children
    if (dropdownRef.current?.contains(e.target as Node)) return;
    setIsHovered(prev => !prev);
  };

  // Handle scroll to date range
  const handleRangeClick = () => {
    if (onScrollToDateRange) {
      onScrollToDateRange();
    } else {
      // Fallback: scroll to top of page
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div>
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ms-3 text-gray-600 dark:text-gray-300">Calculating accuracy...</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {!isLoading && !error && selectedAccuracy && colors && (
        <div 
          ref={containerRef}
          className={`rounded-lg border-2 transition-all duration-200 cursor-pointer ${
            isHovered 
              ? `${colors.bg} ${colors.border}`
              : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30'
          }`}
          onClick={handleContainerClick}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div className="p-4">
            {/* Main Layout: Target + Tiles Grid */}
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              {/* Target with overlay */}
              <div className="relative flex-shrink-0">
                <div className={`transition-opacity duration-200 ${isHovered ? 'opacity-0' : 'opacity-100'}`}>
                  <AccuracyTarget
                    accuracy={selectedAccuracy}
                    globalSettings={personalBudget?.global_settings}
                    size={160}
                  />
                </div>
                
                {/* Hover Overlay - Details */}
                <div 
                  className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${
                    isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
                  }`}
                >
                  <div className="text-center p-3">
                    {selectedAccuracy.dayExceeded && (
                      <p className="text-red-600 dark:text-red-400 text-sm font-medium mb-1">
                        ⚠️ Exceeded day {selectedAccuracy.dayExceeded}
                      </p>
                    )}
                    {selectedAccuracy.isUnused ? (
                      <p className="text-gray-500 dark:text-gray-400 text-sm">No spending</p>
                    ) : selectedAccuracy.variance !== 0 && (
                      <p className={`text-lg font-bold ${selectedAccuracy.variance > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                        {selectedAccuracy.variance > 0 ? '+' : ''}{formatCurrencyFromSettings(selectedAccuracy.variance, personalBudget?.global_settings)}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {selectedAccuracy.transactionCount} txn{selectedAccuracy.transactionCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              </div>

              {/* 6 Tiles Grid: 2x3 on mobile, 3x2 on desktop */}
              <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-2 w-full overflow-visible">
                {/* Tile 1: Category */}
                <div 
                  className="relative p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg overflow-visible"
                  ref={dropdownRef}
                >
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Category</div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsDropdownOpen(!isDropdownOpen);
                    }}
                    className="flex items-center gap-1 text-base font-bold text-gray-900 dark:text-white 
                             hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    <span className="truncate">{selectedCategory}</span>
                    <ChevronDown className={`h-4 w-4 flex-shrink-0 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {isDropdownOpen && (
                    <div className="absolute z-50 start-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 
                                  border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                      {accuracyData.map((accuracy) => (
                        <button
                          key={accuracy.category}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCategory(accuracy.category);
                            setIsDropdownOpen(false);
                          }}
                          className={`w-full text-start px-4 py-2 text-sm 
                                    hover:bg-gray-100 dark:hover:bg-gray-700
                                    first:rounded-t-lg last:rounded-b-lg
                                    ${accuracy.category === selectedCategory 
                                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium' 
                                      : 'text-gray-700 dark:text-gray-300'}`}
                        >
                          {accuracy.category}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tile 2: Range */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRangeClick();
                  }}
                  className="p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg
                           hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-start"
                >
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Range</div>
                  <div className="text-base font-bold text-gray-800 dark:text-white">
                    {dateRangeInfo.startDate.toLocaleDateString(getUserLocale(), { month: 'short', day: 'numeric' })}
                    {' – '}
                    {dateRangeInfo.endDate.toLocaleDateString(getUserLocale(), { month: 'short', day: 'numeric' })}
                  </div>
                </button>

                {/* Tile 3: Status */}
                <div className={`p-3 rounded-lg ${colors.badge}`}>
                  <div className="text-xs opacity-70 mb-1">Status</div>
                  <div className="text-base font-bold truncate">
                    {categoryAccuracyService.getPerformanceLabel(selectedAccuracy.accuracyZone)}
                  </div>
                </div>

                {/* Tile 4: Budgeted */}
                <div className="p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Budgeted</div>
                  <div className="text-base font-bold text-gray-800 dark:text-white">
                    {formatCurrencyFromSettings(selectedAccuracy.budgetAverage, personalBudget?.global_settings)}
                  </div>
                </div>
                
                {/* Tile 5: Actual */}
                <div className="p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Actual</div>
                  <div className="text-base font-bold text-gray-800 dark:text-white">
                    {formatCurrencyFromSettings(selectedAccuracy.actualAverage, personalBudget?.global_settings)}
                  </div>
                </div>
                
                {/* Tile 6: Accuracy */}
                <div className="p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Accuracy</div>
                  <div className={`text-base font-bold ${colors.text}`}>
                    {selectedAccuracy.accuracyPercentage.toFixed(0)}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!isLoading && !error && accuracyData.length === 0 && (
        <div className="text-center py-12 text-gray-600 dark:text-gray-400">
          No category data available for the selected date range.
        </div>
      )}
    </div>
  );
};
