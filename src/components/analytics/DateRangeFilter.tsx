import React from 'react';
import type { DateRangeType } from '../../utils/dateRangeFilters';
import { getDateRange, formatDateRange } from '../../utils/dateRangeFilters';

interface DateRangeFilterProps {
  selectedRange: DateRangeType;
  onRangeChange: (range: DateRangeType) => void;
  oldestTransactionDate?: Date; // Oldest transaction to determine actual data range
}

export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({ 
  selectedRange, 
  onRangeChange,
  oldestTransactionDate,
}) => {
  const { startDate, endDate } = getDateRange(selectedRange);

  // Calculate months of actual data (from oldest transaction to now)
  const monthsOfData = oldestTransactionDate 
    ? Math.max(1, Math.ceil((new Date().getTime() - oldestTransactionDate.getTime()) / (1000 * 60 * 60 * 24 * 30)))
    : 12; // Default to 12 if no transactions

  const filters: { id: DateRangeType; label: string; requiredMonths: number }[] = [
    { id: 'mtd', label: 'Current month', requiredMonths: 1 },
    { id: 'ytd', label: 'Year to date', requiredMonths: 3 }, // Show if at least 3 months of data
    { id: 'qtd', label: 'Quarter to date', requiredMonths: 2 }, // Show if at least 2 months of data
    { id: 'lastQuarter', label: 'Last quarter', requiredMonths: 3 },
    { id: 'lastYear', label: 'Last 12 months', requiredMonths: 6 }, // Show if at least 6 months of data
  ];

  // Filter out ranges that require more months than available data
  const visibleFilters = filters.filter(f => monthsOfData >= f.requiredMonths);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {visibleFilters.map((filter) => (
          <button
            key={filter.id}
            onClick={() => onRangeChange(filter.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              selectedRange === filter.id
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        {formatDateRange(startDate, endDate)}
      </p>
    </div>
  );
};
