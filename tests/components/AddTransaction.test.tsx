import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { applyLanguage } from '../../src/i18n';
import AddTransaction from '../../src/components/AddTransaction';

vi.mock('../../src/context/FinanceContext', () => ({
  useFinance: () => ({
    addTransaction: vi.fn(),
    familyMembers: [{ id: 'm1', name: 'Noa' }],
    setTransactions: vi.fn(),
    refreshTransactions: vi.fn(),
  }),
}));
vi.mock('../../src/hooks/useBudgets', () => ({ useActiveBudget: () => ({ data: null }) }));
vi.mock('../../src/services/bankImportService', () => ({ listConnections: () => Promise.resolve([]) }));
vi.mock('../../src/services/supabaseDataService', () => ({}));
vi.mock('../../src/components/BankImportModal', () => ({ default: () => null }));

const renderOpen = () =>
  render(
    <MemoryRouter>
      <AddTransaction isOpen onClose={() => {}} />
    </MemoryRouter>,
  );

describe('AddTransaction in Hebrew', () => {
  afterEach(() => applyLanguage('en'));

  it('uses the labels the Hebrew guide tells people to look for', () => {
    applyLanguage('he');
    renderOpen();
    // Quoted in src/i18n/locales/guide.he.json (chapter "transactions"); see microcopy/hebrew.md
    expect(screen.getByRole('button', { name: 'בחירה' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'שמירה' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /הכנסה/ })).toBeInTheDocument();
    expect(screen.getByText('פריסה לתשלומים')).toBeInTheDocument();
    expect(screen.getByText('ייבוא תנועות')).toBeInTheDocument();
    expect(screen.getByText('הוספת חשבון')).toBeInTheDocument();
  });

  it('leaves no English in the window apart from the family members\' names', () => {
    applyLanguage('he');
    renderOpen();
    expect(screen.getByRole('heading', { name: '💸 הוספת הוצאה' })).toBeInTheDocument();
    // The window renders through a portal into document.body
    const latin = document.body.textContent?.match(/[A-Za-z]{2,}/g)?.filter((w) => w !== 'Noa') ?? [];
    expect(latin).toEqual([]);
  });
});
