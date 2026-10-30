// Budget History Component
// Shows all budget versions with ability to view, set active, or delete

import React from 'react';
import { 
  Clock, 
  Star, 
  Trash2, 
  CheckCircle,
  AlertCircle,
  Loader2,
  History
} from 'lucide-react';
import {
  usePersonalBudgetHistory,
  useSetActiveBudget,
  useDeletePersonalBudget,
} from '../../hooks/useBudgets';
import type { PersonalBudget } from '../../types/budget';
import { formatCurrencyFromSettings } from '../../utils/formatCurrency';
import { getUserLocale } from '../../utils/locale';
import { useT } from '../../hooks/useT';

interface BudgetHistoryProps {
  className?: string;
  currency?: string;
}

export const BudgetHistory: React.FC<BudgetHistoryProps> = ({ 
  className = '',
  currency = 'ILS'
}) => {
  const t = useT();
  const { data: history = [], isLoading } = usePersonalBudgetHistory();
  const setActive = useSetActiveBudget();
  const deleteBudget = useDeletePersonalBudget();

  const formatCurrency = (amount: number): string => {
    // Get showRoundedAmounts from the first budget's settings if available
    const showRoundedAmounts = history[0]?.global_settings?.showRoundedAmounts ?? true;
    return formatCurrencyFromSettings(amount, { currency, showRoundedAmounts });
  };

  const handleSetActive = async (budgetId: string) => {
    try {
      await setActive.mutateAsync(budgetId);
    } catch (error) {
      console.error('Error setting active budget:', error);
      alert(t('history.setActiveFailed'));
    }
  };

  const handleDelete = async (budgetId: string, isActive: boolean) => {
    const isOnlyBudget = history.length === 1;
    
    let confirmMessage: string;
    if (isOnlyBudget) {
      confirmMessage = t('history.confirmOnly');
    } else if (isActive) {
      confirmMessage = t('history.confirmActive');
    } else {
      confirmMessage = t('history.confirmVersion');
    }

    if (confirm(confirmMessage)) {
      try {
        await deleteBudget.mutateAsync(budgetId);
      } catch (error) {
        console.error('Error deleting budget:', error);
        alert(t('history.deleteFailed'));
      }
    }
  };

  if (isLoading) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          <span className="ms-2 text-gray-500 dark:text-gray-400">{t('history.loading')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            {t('history.title')}
          </h3>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {t('history.versions', { count: history.length })}
          </span>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {t('history.subtitle')}
        </p>
      </div>

      {/* History List */}
      <div className="p-4">
        {history.length === 0 ? (
          <div className="text-center py-8">
            <AlertCircle className="h-10 w-10 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-gray-400">{t('history.empty')}</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
              {t('history.emptyHint')}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((budget: PersonalBudget) => {
              const activeCategories = Object.values(budget.categories).filter(cat => cat.isActive);
              const totalBudget = activeCategories.reduce((sum, cat) => sum + cat.monthlyLimit, 0);
              
              return (
                <div
                  key={budget.id}
                  className={`p-3 rounded-lg border transition-all ${
                    budget.is_active
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                      : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                          {budget.name}
                        </h4>
                        {budget.is_active && (
                          <span className="flex items-center text-xs bg-green-600 text-white px-2 py-0.5 rounded">
                            <CheckCircle className="h-3 w-3 me-1" />
                            {t('history.active')}
                          </span>
                        )}
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          v{budget.version}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {t('history.summary', { count: Object.keys(budget.categories).length, total: formatCurrency(totalBudget) })}
                      </p>
                      {budget.notes && (
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 italic truncate">
                          {budget.notes}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        <Clock className="inline h-3 w-3 me-1" />
                        {t('history.updatedAt', {
                          date: new Date(budget.updated_at).toLocaleDateString(getUserLocale()),
                          time: new Date(budget.updated_at).toLocaleTimeString(getUserLocale(), { hour: '2-digit', minute: '2-digit' }),
                        })}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 ms-2 flex-shrink-0">
                      {!budget.is_active && (
                        <button
                          onClick={() => handleSetActive(budget.id)}
                          disabled={setActive.isPending}
                          className="p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded transition-colors"
                          title={t('history.setActive')}
                          aria-label={t('history.setActive')}
                        >
                          {setActive.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Star className="h-4 w-4" />
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(budget.id, budget.is_active)}
                        disabled={deleteBudget.isPending}
                        className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        title={t(budget.is_active ? 'history.deleteActive' : 'history.deleteVersion')}
                        aria-label={t(budget.is_active ? 'history.deleteActive' : 'history.deleteVersion')}
                      >
                        {deleteBudget.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
