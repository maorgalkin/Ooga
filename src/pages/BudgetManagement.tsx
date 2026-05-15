import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useActiveBudget } from '../hooks/useBudgets';
import { useCategories } from '../hooks/useCategories';
import { PersonalBudgetEditor } from '../components/PersonalBudgetEditor';
import { PersonalBudgetDisplay } from '../components/PersonalBudgetDisplay';
import { CategoryList } from '../components/categories';
import { BudgetSettings } from '../components/settings';
import { Wallet, Tag, Sliders } from 'lucide-react';
import {
  getHeadingColor,
  getSubheadingColor,
  getInactiveBg,
  getInactiveBorderColor,
  getActiveBorderColor,
  getInactiveTextColor,
} from '../utils/themeColors';

type TabType = 'overview' | 'categories' | 'settings';

export const BudgetManagement: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [autoCreate, setAutoCreate] = useState(false);
  const [editCategoryName, setEditCategoryName] = useState<string | null>(null);
  
  const { data: categories } = useCategories(false, 'expense');
  
  const themeColor = 'green';

  // Check if user has an active budget
  const { data: activeBudget, isLoading: loadingActiveBudget } = useActiveBudget();

  // Get category object by name
  const getEditCategory = useCallback(() => {
    if (!editCategoryName || !categories) return null;
    return categories.find(c => c.name === editCategoryName) || null;
  }, [editCategoryName, categories]);

  // Handle category click from Overview - navigate to Categories tab
  const handleCategoryClick = useCallback((categoryName: string) => {
    setEditCategoryName(categoryName);
    setActiveTab('categories');
  }, []);

  // Clear edit category when handled
  const handleInitialEditHandled = useCallback(() => {
    setEditCategoryName(null);
  }, []);

  // Check for 'create' or 'subtab' parameter on mount
  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      setActiveTab('overview');
      setAutoCreate(true);
      setSearchParams({});
    } else if (searchParams.get('subtab') === 'settings') {
      setActiveTab('settings');
      setSearchParams({});
    }
  }, []);

  const tabs = [
    { id: 'overview' as TabType, label: 'Overview', icon: Wallet },
    { id: 'categories' as TabType, label: 'Categories', icon: Tag },
    { id: 'settings' as TabType, label: 'Settings', icon: Sliders },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className={`text-3xl font-bold ${getHeadingColor(themeColor)} mb-2`}>
          Budget Management
        </h1>
        <p className={getSubheadingColor(themeColor)}>
          Manage your budget and track monthly spending
        </p>
      </div>

      {/* Tabs */}
      <div className={`${getInactiveBg(themeColor)} rounded-lg shadow-sm border ${getInactiveBorderColor(themeColor)} mb-6`}>
        <div className={`border-b ${getInactiveBorderColor(themeColor)} overflow-x-auto`}>
          <nav className="flex px-2 sm:px-4" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center justify-center flex-1 px-2 sm:px-4 py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                    ${
                      isActive
                        ? `${getActiveBorderColor(themeColor)} ${getSubheadingColor(themeColor)}`
                        : `border-transparent ${getInactiveTextColor(themeColor)} hover:${getSubheadingColor(themeColor)} hover:${getInactiveBorderColor(themeColor)}`
                    }
                  `}
                >
                  <Icon className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 flex-shrink-0" />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
          {activeTab === 'overview' && (
            loadingActiveBudget ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                Loading budget...
              </div>
            ) : !activeBudget ? (
              // Fresh view - no budget yet
              <div>
                {/* Tips Block - at the top */}
                <div className={`text-sm text-gray-500 dark:text-gray-400 mb-6 p-4 ${getInactiveBg(themeColor)} rounded-lg`}>
                  <p className="font-medium mb-2">💡 Getting Started:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Add your spending categories and set monthly limits</li>
                    <li>Your budget will be created automatically when you save</li>
                    <li>Track spending in real-time with your transaction records</li>
                  </ul>
                </div>
                
                <PersonalBudgetEditor autoCreate={autoCreate} />
              </div>
            ) : (
              // Display mode - show configured budget
              <div>
                {/* Tips Block - at the top */}
                <div className={`text-sm text-gray-500 dark:text-gray-400 mb-6 p-4 ${getInactiveBg(themeColor)} rounded-lg`}>
                  <p className="font-medium mb-2">💡 Your Budget:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>This is your configured budget used for all monthly budgets</li>
                    <li>Click any category to edit its details, limits, or manage it</li>
                    <li>Use the Categories tab for full category management</li>
                  </ul>
                </div>
                
                <PersonalBudgetDisplay 
                  onCategoryClick={handleCategoryClick}
                />
              </div>
            )
          )}

          {activeTab === 'categories' && (
            <div className="space-y-6">
              {/* Category List with full management UI */}
              <CategoryList 
                initialEditCategory={getEditCategory()}
                onInitialEditHandled={handleInitialEditHandled}
              />
            </div>
          )}

          {activeTab === 'settings' && (
            <BudgetSettings />
          )}
      </div>
    </div>
  );
};
