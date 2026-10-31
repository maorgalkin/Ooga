import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const state = vi.hoisted(() => ({
  transactions: [] as unknown[],
  warningNotifications: true,
  seen: new Set<string>(),
}));
const markAlertsSeen = vi.hoisted(() => vi.fn());
const getSeenAlertKeys = vi.hoisted(() => vi.fn());

vi.mock('../../src/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('../../src/context/FinanceContext', () => ({ useFinance: () => ({ transactions: state.transactions }) }));
vi.mock('../../src/hooks/useBudgets', () => ({
  useActiveBudget: () => ({
    data: {
      updated_at: '2026-10-01T00:00:00Z',
      global_settings: { currency: 'ILS', warningNotifications: state.warningNotifications, emailAlerts: false },
      categories: {
        Groceries: { monthlyLimit: 100, warningThreshold: 80, isActive: true },
        Kids: { monthlyLimit: 100, warningThreshold: 80, isActive: true },
        Fun: { monthlyLimit: 100, warningThreshold: 80, isActive: true },
      },
    },
  }),
  useMonthlyBudget: () => ({ data: null }),
}));
vi.mock('../../src/services/userAlertViewService', () => ({
  getSeenAlertKeys,
  markAlertsSeen,
  clearSeenAlerts: vi.fn(),
}));

import { budgetAlertKey, useBudgetAlerts } from '../../src/hooks/useBudgetAlerts';

const OCTOBER = new Date(2026, 9, 15);
const expense = (category: string, amount: number, date = '2026-10-10') => ({ id: `${category}-${amount}`, date, amount, category, type: 'expense', description: '' });

function render() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return renderHook(() => useBudgetAlerts(OCTOBER), { wrapper });
}

describe('useBudgetAlerts', () => {
  beforeEach(() => {
    state.transactions = [expense('Groceries', 150), expense('Kids', 85), expense('Fun', 10)];
    state.warningNotifications = true;
    state.seen = new Set();
    getSeenAlertKeys.mockReset().mockImplementation(async () => new Set(state.seen));
    markAlertsSeen.mockReset().mockResolvedValue(undefined);
  });

  it('gives one alert per category: over the limit, or near it', async () => {
    const { result } = render();
    await waitFor(() => expect(result.current.unseen).toHaveLength(2));
    expect(result.current.alerts.map(({ category, level }) => [category, level])).toEqual([['Groceries', 'over'], ['Kids', 'near']]);
  });

  it('marks a category seen for good when it is opened', async () => {
    const { result } = render();
    await waitFor(() => expect(result.current.unseen).toHaveLength(2));
    act(() => result.current.markCategorySeen('Groceries'));
    await waitFor(() => expect(markAlertsSeen).toHaveBeenCalledWith('u1', ['2026-10:over:Groceries']));
    await waitFor(() => expect(result.current.unseen.map((a) => a.category)).toEqual(['Kids']));
  });

  it('keeps an alert seen as spending grows, and alerts again from near to over', async () => {
    state.seen = new Set([budgetAlertKey(OCTOBER, 'Groceries', 'over'), budgetAlertKey(OCTOBER, 'Kids', 'near')]);
    state.transactions.push(expense('Groceries', 40));
    const first = render();
    await waitFor(() => expect(first.result.current.alerts).toHaveLength(2));
    expect(first.result.current.unseen).toEqual([]);

    state.transactions.push(expense('Kids', 30));
    const second = render();
    await waitFor(() => expect(second.result.current.unseen.map((a) => [a.category, a.level])).toEqual([['Kids', 'over']]));
  });

  it('shows nothing new until it knows what was seen', () => {
    getSeenAlertKeys.mockReturnValue(new Promise(() => {}));
    const { result } = render();
    expect(result.current.alerts).toHaveLength(2);
    expect(result.current.unseen).toEqual([]);
  });

  it('stays quiet when the budget turns warning notifications off', async () => {
    state.warningNotifications = false;
    const { result } = render();
    await waitFor(() => expect(getSeenAlertKeys).toHaveBeenCalled());
    expect(result.current.alerts).toEqual([]);
  });

  it('keys an alert by month, level and category', () => {
    expect(budgetAlertKey(new Date(2026, 0, 31), 'Kids', 'near')).toBe('2026-01:near:Kids');
  });
});
