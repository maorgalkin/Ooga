import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { useT } from '../../hooks/useT';
import type { FamilyMember } from '../../types';
import { flattenCategoryGroups, type CategoryGroup } from '../../utils/transactionFilters';

interface TransactionFilterTreeProps {
  // Multi-select filter arrays
  selectedTypes: ('income' | 'expense')[];
  selectedMembers: string[]; // member IDs
  selectedCategories: string[];
  
  // Available options
  familyMembers: FamilyMember[];
  categoryGroups: CategoryGroup[]; // Follows the selected transaction types
  
  // Callbacks
  onTypeChange: (types: ('income' | 'expense')[]) => void;
  onMemberChange: (memberIds: string[]) => void;
  onCategoryChange: (categories: string[]) => void;
}

export const TransactionFilterTree: React.FC<TransactionFilterTreeProps> = ({
  selectedTypes,
  selectedMembers,
  selectedCategories,
  familyMembers,
  categoryGroups,
  onTypeChange,
  onMemberChange,
  onCategoryChange,
}) => {
  const t = useT();
  const categories = useMemo(() => flattenCategoryGroups(categoryGroups), [categoryGroups]);

  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['type', 'members', 'categories'])
  );

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  // Type section logic
  const allTypes: ('income' | 'expense')[] = ['income', 'expense'];
  const isAllTypesSelected = selectedTypes.length === allTypes.length;
  const isTypesIndeterminate = selectedTypes.length > 0 && selectedTypes.length < allTypes.length;

  const handleTypeToggle = (type: 'income' | 'expense') => {
    if (selectedTypes.includes(type)) {
      onTypeChange(selectedTypes.filter(t => t !== type));
    } else {
      onTypeChange([...selectedTypes, type]);
    }
  };

  const handleTypeSelectAll = () => {
    if (isAllTypesSelected) {
      onTypeChange([]);
    } else {
      onTypeChange([...allTypes]);
    }
  };

  // Members section logic
  const allMemberIds = familyMembers.map(m => m.id);
  const isAllMembersSelected = selectedMembers.length === allMemberIds.length;
  const isMembersIndeterminate = selectedMembers.length > 0 && selectedMembers.length < allMemberIds.length;

  const handleMemberToggle = (memberId: string) => {
    if (selectedMembers.includes(memberId)) {
      onMemberChange(selectedMembers.filter(m => m !== memberId));
    } else {
      onMemberChange([...selectedMembers, memberId]);
    }
  };

  const handleMemberSelectAll = () => {
    if (isAllMembersSelected) {
      onMemberChange([]);
    } else {
      onMemberChange([...allMemberIds]);
    }
  };

  // Categories section logic
  const isAllCategoriesSelected = selectedCategories.length === categories.length;
  const isCategoriesIndeterminate = selectedCategories.length > 0 && selectedCategories.length < categories.length;

  const handleCategoryToggle = (category: string) => {
    if (selectedCategories.includes(category)) {
      onCategoryChange(selectedCategories.filter(c => c !== category));
    } else {
      onCategoryChange([...selectedCategories, category]);
    }
  };

  const handleCategorySelectAll = () => {
    if (isAllCategoriesSelected) {
      onCategoryChange([]);
    } else {
      onCategoryChange([...categories]);
    }
  };

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    const allTypesLength = allTypes.length;
    if (selectedTypes.length > 0 && selectedTypes.length < allTypesLength) count++;
    if (selectedMembers.length > 0 && selectedMembers.length < allMemberIds.length) count++;
    if (selectedCategories.length > 0 && selectedCategories.length < categories.length) count++;
    return count;
  }, [selectedTypes, selectedMembers, selectedCategories, allMemberIds.length, categories.length, allTypes.length]);

  const handleClearAll = () => {
    onTypeChange([]);
    onMemberChange([]);
    onCategoryChange([]);
  };

  return (
    <div className="hidden lg:block bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 h-fit sticky top-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {t('transactions.filters.title')}
        </h3>
        {activeFilterCount > 0 && (
          <button
            onClick={handleClearAll}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            {t('transactions.filters.clear', { count: activeFilterCount })}
          </button>
        )}
      </div>

      {/* Transaction Type Section */}
      <div className="border-b border-gray-200 dark:border-gray-700 pb-3 mb-3">
        <button
          onClick={() => toggleSection('type')}
          className="flex items-center justify-between w-full text-start text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          <span>{t('transactions.filters.type')}</span>
          {expandedSections.has('type') ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4 rtl:-scale-x-100" />
          )}
        </button>

        {expandedSections.has('type') && (
          <div className="mt-2 space-y-2 ps-2">
            {/* Select All */}
            <label className="flex items-center space-x-2 rtl:space-x-reverse cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 py-1 px-2 rounded transition-colors">
              <input
                type="checkbox"
                checked={isAllTypesSelected}
                ref={el => {
                  if (el) el.indeterminate = isTypesIndeterminate;
                }}
                onChange={handleTypeSelectAll}
                className="w-4 h-4 text-blue-600 rounded border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('transactions.filters.selectAll')}
              </span>
            </label>

            {/* Income */}
            <label className="flex items-center space-x-2 rtl:space-x-reverse cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 py-1 px-2 rounded transition-colors">
              <input
                type="checkbox"
                checked={selectedTypes.includes('income')}
                onChange={() => handleTypeToggle('income')}
                className="w-4 h-4 text-blue-600 rounded border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">{t('transactions.filters.income')}</span>
            </label>

            {/* Expense */}
            <label className="flex items-center space-x-2 rtl:space-x-reverse cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 py-1 px-2 rounded transition-colors">
              <input
                type="checkbox"
                checked={selectedTypes.includes('expense')}
                onChange={() => handleTypeToggle('expense')}
                className="w-4 h-4 text-blue-600 rounded border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">{t('transactions.filters.expense')}</span>
            </label>
          </div>
        )}
      </div>

      {/* Family Members Section */}
      <div className="border-b border-gray-200 dark:border-gray-700 pb-3 mb-3">
        <button
          onClick={() => toggleSection('members')}
          className="flex items-center justify-between w-full text-start text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          <span>{t('transactions.filters.members')}</span>
          {expandedSections.has('members') ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4 rtl:-scale-x-100" />
          )}
        </button>

        {expandedSections.has('members') && (
          <div className="mt-2 space-y-2 ps-2 max-h-48 overflow-y-auto">
            {/* Select All */}
            <label className="flex items-center space-x-2 rtl:space-x-reverse cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 py-1 px-2 rounded transition-colors">
              <input
                type="checkbox"
                checked={isAllMembersSelected}
                ref={el => {
                  if (el) el.indeterminate = isMembersIndeterminate;
                }}
                onChange={handleMemberSelectAll}
                className="w-4 h-4 text-blue-600 rounded border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('transactions.filters.selectAll')}
              </span>
            </label>

            {/* Individual Members */}
            {familyMembers.map(member => (
              <label
                key={member.id}
                className="flex items-center space-x-2 rtl:space-x-reverse cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 py-1 px-2 rounded transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedMembers.includes(member.id)}
                  onChange={() => handleMemberToggle(member.id)}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {member.name}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Categories Section */}
      <div>
        <button
          onClick={() => toggleSection('categories')}
          className="flex items-center justify-between w-full text-start text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          <span>{t('transactions.filters.categories')}</span>
          {expandedSections.has('categories') ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4 rtl:-scale-x-100" />
          )}
        </button>

        {expandedSections.has('categories') && (
          <div className="mt-2 space-y-2 ps-2 max-h-64 overflow-y-auto">
            {/* Select All */}
            <label className="flex items-center space-x-2 rtl:space-x-reverse cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 py-1 px-2 rounded transition-colors">
              <input
                type="checkbox"
                checked={isAllCategoriesSelected}
                ref={el => {
                  if (el) el.indeterminate = isCategoriesIndeterminate;
                }}
                onChange={handleCategorySelectAll}
                className="w-4 h-4 text-blue-600 rounded border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('transactions.filters.selectAll')}
              </span>
            </label>

            {/* Individual categories, headed by type when both types are listed */}
            {categoryGroups.map(group => (
              <div key={group.type}>
                {categoryGroups.length > 1 && (
                  <p className="px-2 pt-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                    {t(group.type === 'income' ? 'common.income' : 'common.expenses')}
                  </p>
                )}
                {group.categories.map(category => (
                  <label
                    key={category}
                    className="flex items-center space-x-2 rtl:space-x-reverse cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 py-1 px-2 rounded transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(category)}
                      onChange={() => handleCategoryToggle(category)}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {category}
                    </span>
                  </label>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
