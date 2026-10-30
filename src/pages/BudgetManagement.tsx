import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useT } from '../hooks/useT';
import { useActiveBudget } from '../hooks/useBudgets';
import { useCategories } from '../hooks/useCategories';
import { PersonalBudgetEditor } from '../components/PersonalBudgetEditor';
import { BudgetOverviewTab } from '../components/budget/BudgetOverviewTab';
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
  const t = useT();
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

  // Clear edit category when handled
  const handleInitialEditHandled = useCallback(() => {
    setEditCategoryName(null);
  }, []);

  // Check for 'create' or 'subtab' parameter on mount
  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      setActiveTab('overview');
      setAutoCreate(true);
      const p = new URLSearchParams(searchParams);
      p.delete('create');
      setSearchParams(p, { replace: true });
    } else if (searchParams.get('subtab') === 'settings' || searchParams.get('subtab') === 'categories') {
      setActiveTab(searchParams.get('subtab') as TabType);
      const p = new URLSearchParams(searchParams);
      p.delete('subtab');
      setSearchParams(p, { replace: true });
    }
  }, []);

  const tabs = [
    { id: 'overview' as TabType, label: t('budget.tabs.overview'), icon: Wallet },
    { id: 'categories' as TabType, label: t('budget.tabs.categories'), icon: Tag },
    { id: 'settings' as TabType, label: t('budget.tabs.settings'), icon: Sliders },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className={`text-3xl font-bold ${getHeadingColor(themeColor)} mb-2`}>
          {t('budget.title')}
        </h1>
        <p className={getSubheadingColor(themeColor)}>
          {t('budget.subtitle')}
        </p>
      </div>

      {/* Tabs */}
      <div className={`${getInactiveBg(themeColor)} rounded-lg shadow-sm border ${getInactiveBorderColor(themeColor)} mb-6`}>
        <div className={`border-b ${getInactiveBorderColor(themeColor)} overflow-x-auto`}>
          <nav className="flex px-2 sm:px-4" aria-label={t('budget.tabsLabel')}>
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
                  <Icon className="h-3 w-3 sm:h-4 sm:w-4 me-1 sm:me-2 flex-shrink-0" />
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
                {t('dashboard.performance.loading')}
              </div>
            ) : !activeBudget ? (
              // Fresh view - no budget yet
              <div>
                {/* Tips Block - at the top */}
                <div className={`text-sm text-gray-500 dark:text-gray-400 mb-6 p-4 ${getInactiveBg(themeColor)} rounded-lg`}>
                  <p className="font-medium mb-2">{t('budget.tips.title')}</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>{t('budget.tips.categories')}</li>
                    <li>{t('budget.tips.autoCreate')}</li>
                    <li>{t('budget.tips.track')}</li>
                  </ul>
                </div>
                
                <PersonalBudgetEditor autoCreate={autoCreate} />
              </div>
            ) : (
              // Display mode - rich overview
              <BudgetOverviewTab />
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
