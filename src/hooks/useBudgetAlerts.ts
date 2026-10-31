import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useFinance } from '../context/FinanceContext';
import { useActiveBudget, useMonthlyBudget } from './useBudgets';
import { budgetService } from '../services/budgetService';
import { clearSeenAlerts, getSeenAlertKeys, markAlertsSeen } from '../services/userAlertViewService';
import type { BudgetConfiguration } from '../types';
import type { MonthlyBudget, PersonalBudget } from '../types/budget';

/** over: past the category's limit · near: at or past its warning threshold */
export type AlertLevel = 'over' | 'near';

export interface CategoryAlert {
  category: string;
  level: AlertLevel;
  /** Identifies the alert in what a person has seen; see budgetAlertKey. */
  key: string;
  seen: boolean;
}

const NOTHING_SEEN = new Set<string>();

export const alertViewKeys = {
  seen: (userId: string | undefined) => ['alertViews', userId] as const,
};

/**
 * An alert is one category at one level in one month: seeing it covers more spending at that
 * level, and crossing from near to over is a new alert.
 */
export const budgetAlertKey = (month: Date, category: string, level: AlertLevel) =>
  `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}:${level}:${category}`;

/** The budget as budgetService reads it: the month's own limits (mid-month edits included) when there are any. */
export function toBudgetConfiguration(
  personalBudget: PersonalBudget,
  monthlyBudget?: Pick<MonthlyBudget, 'categories' | 'updated_at'> | null,
): BudgetConfiguration {
  return {
    version: '2.0.0',
    lastUpdated: monthlyBudget?.updated_at || personalBudget.updated_at,
    categories: { ...(monthlyBudget?.categories ?? personalBudget.categories) },
    globalSettings: personalBudget.global_settings,
  };
}

/**
 * The month's budget alerts and which of them the signed-in person has seen. The Dashboard tab's
 * badge counts the unseen ones of the current month; category tiles and rows show them as dots.
 * Opening a category marks its alert seen, for this person, on every device.
 */
export function useBudgetAlerts(month: Date) {
  const { user } = useAuth();
  const userId = user?.id;
  const { transactions } = useFinance();
  const { data: personalBudget } = useActiveBudget();
  const { data: monthlyBudget } = useMonthlyBudget(month.getFullYear(), month.getMonth() + 1);
  const queryClient = useQueryClient();

  const seenQuery = useQuery({
    queryKey: alertViewKeys.seen(userId),
    queryFn: () => getSeenAlertKeys(userId!),
    enabled: !!userId,
  });
  // Until we know what was seen nothing counts as new, so a badge doesn't flash and vanish.
  // If that can't be read, everything counts as new rather than alerts going quiet.
  const seenKeys = seenQuery.isError ? NOTHING_SEEN : seenQuery.data;

  const monthTime = new Date(month.getFullYear(), month.getMonth(), 1).getTime();
  const alerts = useMemo((): CategoryAlert[] => {
    if (!personalBudget) return [];
    const monthStart = new Date(monthTime);
    const analysis = budgetService.analyzeBudgetPerformanceWithConfig(
      transactions,
      // budgetService parses English month names
      monthStart.toLocaleDateString('en-US', { month: 'long' }),
      monthStart.getFullYear(),
      toBudgetConfiguration(personalBudget, monthlyBudget),
    );
    return analysis.alerts.map((alert) => {
      const level: AlertLevel = alert.type === 'budgetExceeded' ? 'over' : 'near';
      const key = budgetAlertKey(monthStart, alert.category, level);
      return { category: alert.category, level, key, seen: seenKeys?.has(key) ?? false };
    });
  }, [transactions, personalBudget, monthlyBudget, seenKeys, monthTime]);

  const unseen = useMemo(() => (seenKeys ? alerts.filter((a) => !a.seen) : []), [alerts, seenKeys]);

  const markSeen = useMutation({
    mutationFn: (keys: string[]) => markAlertsSeen(userId!, keys),
    onMutate: (keys) => {
      queryClient.setQueryData<Set<string>>(alertViewKeys.seen(userId), (prev) => new Set([...(prev ?? []), ...keys]));
    },
    onError: (error) => {
      console.error('Saving seen alerts failed:', error instanceof Error ? error.message : error);
      void queryClient.invalidateQueries({ queryKey: alertViewKeys.seen(userId) });
    },
  });

  /** Marks the category's alert seen, if it has an unseen one. */
  const markCategorySeen = useCallback(
    (category: string) => {
      const keys = unseen.filter((a) => a.category === category).map((a) => a.key);
      if (keys.length && userId) markSeen.mutate(keys);
    },
    [unseen, userId, markSeen],
  );

  const clearSeen = useCallback(async () => {
    if (!userId) return;
    await clearSeenAlerts(userId);
    await queryClient.invalidateQueries({ queryKey: alertViewKeys.seen(userId) });
  }, [userId, queryClient]);

  const unseenFor = useCallback((category: string) => unseen.find((a) => a.category === category), [unseen]);

  return { alerts, unseen, unseenFor, markCategorySeen, clearSeen };
}
