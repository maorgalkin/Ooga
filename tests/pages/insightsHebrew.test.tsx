import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { applyLanguage } from '../../src/i18n';
import { InsightsPage } from '../../src/pages/InsightsPage';
import { CategoryPacingInsight } from '../../src/components/analytics/CategoryPacingInsight';
import CustomDateRangeModal from '../../src/components/CustomDateRangeModal';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';

// Old enough data that the longer ranges (Year to date) show
const transactions = [
  { id: 'a', description: 'Shufersal', date: '2025-01-15', amount: 300, category: 'Groceries', type: 'expense' },
  { id: 'b', description: 'Salary', date: new Date().toISOString().slice(0, 10), amount: 9000, category: 'Salary', type: 'income' },
];

vi.mock('../../src/context/FinanceContext', () => ({
  useFinance: () => ({ transactions, familyMembers: [] }),
}));
vi.mock('../../src/hooks/useBudgets', () => ({
  useActiveBudget: () => ({ data: null, isLoading: false, error: null }),
}));
// The charts have their own data hooks; this test is about the page's own words
vi.mock('../../src/components/analytics/BudgetVsActual', () => ({ BudgetVsActual: () => null }));
vi.mock('../../src/components/analytics/CategoryAccuracyChart', () => ({ CategoryAccuracyChart: () => null }));
vi.mock('../../src/components/analytics/HouseholdMemberExpenses', () => ({ HouseholdMemberExpenses: () => null }));

// Latin words left on screen, apart from the fixture's data (adjacent fields can run together in textContent)
const english = (text: string | null) =>
  (text?.match(/[A-Za-z]{2,}/g) ?? []).filter((w) => !/^(Shufersal|Salary|Groceries)+$/.test(w));

describe('Insights in Hebrew', () => {
  beforeEach(() => applyLanguage('he'));
  afterEach(() => applyLanguage('en'));

  it('uses the names the Hebrew guide gives the Insights sections and ranges', () => {
    const { container } = render(<InsightsPage />);
    // Quoted in src/i18n/locales/guide.he.json (chapter "insights")
    expect(screen.getByRole('heading', { level: 1, name: 'תובנות' })).toBeInTheDocument();
    for (const name of ['סיכום התקציב', 'דיוק לפי קטגוריה', 'קצב לפי קטגוריה', 'הוצאות לפי בני משפחה']) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'החודש הנוכחי' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'מתחילת השנה' })).toBeInTheDocument();
    expect(english(container.textContent)).toEqual([]);
  });

  it('explains the pace tracker in Hebrew when there is no budget yet', () => {
    const { container } = render(<CategoryPacingInsight transactions={[]} personalBudget={null} selectedRange="mtd" />);
    expect(screen.getByText('כדי לעקוב אחרי הקצב מול התקרות, צריך קודם להגדיר תקציב.')).toBeInTheDocument();
    expect(english(container.textContent)).toEqual([]);
  });

  it('shows the custom date range window in Hebrew', () => {
    render(<CustomDateRangeModal isOpen onClose={() => {}} />);
    expect(screen.getByRole('heading', { name: 'טווח תאריכים מותאם' })).toBeInTheDocument();
    // The icon in the corner and the footer button
    expect(screen.getAllByRole('button', { name: 'סגירה' })).toHaveLength(2);
    expect(english(document.body.textContent)).toEqual([]);
  });

  it('shows the error screen in Hebrew', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const Boom = () => {
      throw new Error('boom');
    };
    render(
      <ErrorBoundary autoReloadOnCriticalError={false}>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('heading', { name: 'משהו השתבש' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ניסיון חוזר' })).toBeInTheDocument();
    spy.mockRestore();
  });
});
