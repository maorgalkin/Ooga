import React, { useMemo } from 'react';
import { useFinance } from '../../context/FinanceContext';
import type { DateRangeType } from '../../utils/dateRangeFilters';
import { getDateRange } from '../../utils/dateRangeFilters';
import { Users } from 'lucide-react';
import { formatCurrencyFromSettings, type CurrencySettings } from '../../utils/formatCurrency';

interface HouseholdMemberExpensesProps {
  selectedRange: DateRangeType;
  globalSettings?: CurrencySettings;
}

interface MemberExpenseData {
  memberId: string;
  memberName: string;
  memberColor: string;
  totalExpenses: number;
  transactionCount: number;
  averageTransaction: number;
  percentage: number;
  categories: Record<string, number>;
}

export const HouseholdMemberExpenses: React.FC<HouseholdMemberExpensesProps> = ({
  selectedRange,
  globalSettings,
}) => {
  const { transactions, familyMembers } = useFinance();

  const memberExpenseData = useMemo(() => {
    // Filter transactions by date range
    const { startDate, endDate } = getDateRange(selectedRange);
    const filteredTransactions = transactions.filter(t => {
      if (t.type !== 'expense') return false;
      const transactionDate = new Date(t.date);
      return transactionDate >= startDate && transactionDate <= endDate;
    });

    // Calculate total expenses for percentage
    const totalExpenses = filteredTransactions.reduce((sum, t) => sum + t.amount, 0);

    // Group by family member
    const memberMap = new Map<string, MemberExpenseData>();

    // Initialize "Unassigned" category
    const unassignedData: MemberExpenseData = {
      memberId: 'unassigned',
      memberName: 'Unassigned',
      memberColor: '#9CA3AF',
      totalExpenses: 0,
      transactionCount: 0,
      averageTransaction: 0,
      percentage: 0,
      categories: {},
    };

    filteredTransactions.forEach(transaction => {
      const memberId = transaction.familyMember || 'unassigned';
      
      if (memberId === 'unassigned') {
        unassignedData.totalExpenses += transaction.amount;
        unassignedData.transactionCount += 1;
        unassignedData.categories[transaction.category] = 
          (unassignedData.categories[transaction.category] || 0) + transaction.amount;
      } else {
        if (!memberMap.has(memberId)) {
          const member = familyMembers.find(m => m.id === memberId);
          memberMap.set(memberId, {
            memberId,
            memberName: member?.name || 'Unknown',
            memberColor: member?.color || '#6366F1',
            totalExpenses: 0,
            transactionCount: 0,
            averageTransaction: 0,
            percentage: 0,
            categories: {},
          });
        }

        const data = memberMap.get(memberId)!;
        data.totalExpenses += transaction.amount;
        data.transactionCount += 1;
        data.categories[transaction.category] = 
          (data.categories[transaction.category] || 0) + transaction.amount;
      }
    });

    // Calculate percentages and averages
    const allMembers: MemberExpenseData[] = Array.from(memberMap.values());
    
    if (unassignedData.transactionCount > 0) {
      unassignedData.averageTransaction = unassignedData.totalExpenses / unassignedData.transactionCount;
      unassignedData.percentage = totalExpenses > 0 ? (unassignedData.totalExpenses / totalExpenses) * 100 : 0;
      allMembers.push(unassignedData);
    }

    allMembers.forEach(member => {
      member.averageTransaction = member.totalExpenses / member.transactionCount;
      member.percentage = totalExpenses > 0 ? (member.totalExpenses / totalExpenses) * 100 : 0;
    });

    // Sort by total expenses descending
    return allMembers.sort((a, b) => b.totalExpenses - a.totalExpenses);
  }, [transactions, familyMembers, selectedRange]);

  const formatCurrency = (amount: number) => formatCurrencyFromSettings(amount, globalSettings);

  if (memberExpenseData.length === 0) {
    return (
      <div className="text-center py-8">
        <Users className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
        <p className="text-gray-500 dark:text-gray-400">
          No expense data available for the selected period
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Member Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {memberExpenseData.map(member => (
          <div
            key={member.memberId}
            className="bg-white dark:bg-gray-700 rounded-lg p-5 border border-gray-200 dark:border-gray-600 hover:shadow-md transition-shadow"
          >
            {/* Member Header */}
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                style={{ backgroundColor: member.memberColor }}
              >
                {member.memberName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {member.memberName}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {member.transactionCount} transaction{member.transactionCount !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {/* Stats */}
            <div className="space-y-3">
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Total expenses</span>
                  <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {formatCurrency(member.totalExpenses)}
                  </span>
                </div>
                {/* Percentage bar */}
                <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ 
                      width: `${member.percentage}%`,
                      backgroundColor: member.memberColor 
                    }}
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {member.percentage.toFixed(1)}% of total
                </p>
              </div>

              <div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Average per transaction</span>
                <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  {formatCurrency(member.averageTransaction)}
                </p>
              </div>

              {/* Top Categories */}
              <div>
                <span className="text-sm text-gray-600 dark:text-gray-400 mb-2 block">
                  Top categories
                </span>
                <div className="space-y-1">
                  {Object.entries(member.categories)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3)
                    .map(([category, amount]) => (
                      <div key={category} className="flex justify-between text-xs">
                        <span className="text-gray-600 dark:text-gray-400 truncate me-2">
                          {category}
                        </span>
                        <span className="text-gray-900 dark:text-gray-100 font-medium whitespace-nowrap">
                          {formatCurrency(amount)}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary Table (for larger screens) */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-start text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                Member
              </th>
              <th className="px-4 py-3 text-end text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                Transactions
              </th>
              <th className="px-4 py-3 text-end text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                Total
              </th>
              <th className="px-4 py-3 text-end text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                Average
              </th>
              <th className="px-4 py-3 text-end text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                % of Total
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {memberExpenseData.map(member => (
              <tr key={member.memberId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-xs"
                      style={{ backgroundColor: member.memberColor }}
                    >
                      {member.memberName.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {member.memberName}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-end text-sm text-gray-900 dark:text-gray-100">
                  {member.transactionCount}
                </td>
                <td className="px-4 py-3 text-end text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {formatCurrency(member.totalExpenses)}
                </td>
                <td className="px-4 py-3 text-end text-sm text-gray-900 dark:text-gray-100">
                  {formatCurrency(member.averageTransaction)}
                </td>
                <td className="px-4 py-3 text-end text-sm text-gray-900 dark:text-gray-100">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-16 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ 
                          width: `${member.percentage}%`,
                          backgroundColor: member.memberColor 
                        }}
                      />
                    </div>
                    <span>{member.percentage.toFixed(1)}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
