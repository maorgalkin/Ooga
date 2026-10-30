import React from 'react';
import { AccuracyTarget } from './AccuracyTarget';
import type { CategoryAccuracy } from '../../types/analytics';
import { ACCURACY_ZONE_STYLES } from '../../types/analytics';
import type { CurrencySettings } from '../../utils/formatCurrency';

interface AccuracyTargetGridProps {
  accuracyData: CategoryAccuracy[];
  globalSettings?: CurrencySettings;
  isLoading?: boolean;
}

/**
 * Grid layout for displaying multiple accuracy targets
 * Responsive design with filtering and sorting options
 */
export const AccuracyTargetGrid: React.FC<AccuracyTargetGridProps> = ({
  accuracyData,
  globalSettings,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500 dark:text-gray-400">Loading accuracy data...</div>
      </div>
    );
  }

  if (accuracyData.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500 dark:text-gray-400 text-lg">
          No category data available for the selected period
        </div>
        <div className="text-gray-400 dark:text-gray-500 text-sm mt-2">
          Try selecting a different date range
        </div>
      </div>
    );
  }

  // Sort by accuracy zone (best to worst) then by variance
  const sortedData = [...accuracyData].sort((a, b) => {
    // Unused categories go last
    if (a.isUnused && !b.isUnused) return 1;
    if (!a.isUnused && b.isUnused) return -1;
    
    // Sort by how close to 100% (perfect accuracy)
    const aDeviation = Math.abs(a.accuracyPercentage - 100);
    const bDeviation = Math.abs(b.accuracyPercentage - 100);
    return aDeviation - bDeviation;
  });

  // Calculate summary statistics
  const usedCategories = accuracyData.filter(a => !a.isUnused);
  const averageAccuracy = usedCategories.length > 0
    ? usedCategories.reduce((sum, a) => sum + Math.abs(a.accuracyPercentage - 100), 0) / usedCategories.length
    : 0;
  
  const perfectCount = usedCategories.filter(a => a.accuracyZone === 'bullseye').length;
  const overBudgetCount = usedCategories.filter(a => a.isOverBudget).length;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-500 dark:text-gray-400">Average Deviation</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
            {averageAccuracy.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            From target budget
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-500 dark:text-gray-400">Perfect Accuracy</div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
            {perfectCount} / {usedCategories.length}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Categories on target
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-500 dark:text-gray-400">Over Budget</div>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
            {overBudgetCount}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Categories exceeded
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          Accuracy Zones
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-3">
          {Object.entries(ACCURACY_ZONE_STYLES).map(([zone, style]) => (
            <div key={zone} className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full flex-shrink-0"
                style={{ backgroundColor: style.color }}
              />
              <div className="text-xs">
                <div className="font-medium text-gray-700 dark:text-gray-300">{style.label}</div>
                <div className="text-gray-500 dark:text-gray-400">{style.description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Target Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
        {sortedData.map((accuracy) => (
          <div key={accuracy.category} className="flex justify-center">
            <AccuracyTarget
              accuracy={accuracy}
              globalSettings={globalSettings}
              size={160}
            />
          </div>
        ))}
      </div>

      {/* Recommendations */}
      {accuracyData.some(a => a.isUnused) && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="text-blue-600 dark:text-blue-400 text-xl">💡</div>
            <div>
              <div className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                Optimization Opportunity
              </div>
              <div className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                You have {accuracyData.filter(a => a.isUnused).length} unused budget
                {accuracyData.filter(a => a.isUnused).length !== 1 ? ' categories' : ' category'}.
                Consider reallocating these funds to categories that are consistently over budget.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
