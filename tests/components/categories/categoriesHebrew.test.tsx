import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { applyLanguage } from '../../../src/i18n';
import { CategoryList } from '../../../src/components/categories/CategoryList';
import { CategoryEditModal } from '../../../src/components/categories/CategoryEditModal';
import type { Category } from '../../../src/types/category';

// vi.mock factories run before the rest of the file, so their data is hoisted with them
const { CATEGORIES, mutation } = vi.hoisted(() => {
  const category = (id: string, name: string, monthlyLimit: number) =>
    ({ id, name, type: 'expense', color: '#22c55e', monthlyLimit, warningThreshold: 80, isActive: true, userId: 'u1' }) as unknown as Category;
  return {
    CATEGORIES: [category('c1', 'Groceries', 3200), category('c2', 'Kids', 1200)],
    mutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false, isError: false }),
  };
});
vi.mock('../../../src/hooks/useCategories', () => ({
  useCategories: () => ({ data: CATEGORIES, isLoading: false, error: null }),
  useUpdateCategory: mutation,
  useRenameCategory: mutation,
  useDeleteCategory: mutation,
  useMergeCategories: mutation,
  useCreateCategory: mutation,
}));
vi.mock('../../../src/hooks/useBudgets', () => ({
  useNextMonthAdjustments: () => ({ data: undefined }),
  useCurrentMonthBudget: () => ({ data: undefined }),
  useActiveBudget: () => ({ data: undefined }),
  useCancelAdjustment: mutation,
  useScheduleAdjustment: mutation,
  useUpdateCategoryLimit: mutation,
}));
vi.mock('../../../src/context/FinanceContext', () => ({
  useFinance: () => ({ transactions: [{ id: 't1', category_id: 'c1', category: 'Groceries' }], refreshTransactions: vi.fn() }),
}));

// Latin words on screen apart from the categories' own names (data, not UI)
const englishLeft = () =>
  (document.body.textContent?.match(/[A-Za-z]{2,}/g) ?? []).filter((w) => !['Groceries', 'Kids'].includes(w));

describe('categories in Hebrew', () => {
  afterEach(() => applyLanguage('en'));

  it('lists the categories with the edit button the guide names', () => {
    applyLanguage('he');
    render(<CategoryList />);
    expect(screen.getByRole('heading', { name: 'הקטגוריות שלך' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'עריכה' })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'הוספת קטגוריה' })).toBeInTheDocument();
    expect(englishLeft()).toEqual([]);
  });

  it('names the edit window tabs as the guide does, on every tab', async () => {
    applyLanguage('he');
    render(<CategoryEditModal isOpen category={CATEGORIES[0]} onClose={() => {}} />);
    expect(screen.getByRole('heading', { name: 'עריכת קטגוריה' })).toBeInTheDocument();
    for (const tab of ['פרטים', 'מיזוג', 'התאמה']) {
      await userEvent.click(screen.getByRole('button', { name: tab }));
      expect(englishLeft()).toEqual([]);
    }
    expect(screen.getByText('תקרה חדשה')).toBeInTheDocument();
  });
});
