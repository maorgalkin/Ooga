import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { applyLanguage } from '../../src/i18n';
import BankImportModal from '../../src/components/BankImportModal';
import AddBankAccountModal from '../../src/components/AddBankAccountModal';
import ConnectedAccountsSettings from '../../src/components/ConnectedAccountsSettings';
import DuplicatesBubble from '../../src/components/DuplicatesBubble';

const { listConnections } = vi.hoisted(() => ({ listConnections: vi.fn() }));

vi.mock('../../src/services/bankImportService', () => ({
  listConnections,
  deleteConnection: vi.fn(),
  addConnection: vi.fn(),
  requestCalOtpForConnection: vi.fn(),
  importCalDirect: vi.fn(),
  fetchImportedTransactions: vi.fn(async () => []),
  deleteTransactions: vi.fn(),
}));
vi.mock('../../src/services/scraperService', () => ({
  addSecureConnection: vi.fn(),
  startServerImport: vi.fn(),
  waitForServerImport: vi.fn(),
}));
vi.mock('../../src/services/reconcileService', () => ({ undoMergesForSession: vi.fn() }));
vi.mock('../../src/components/ImportReviewStep', () => ({ default: () => null }));

const discount = { id: 'c1', user_id: 'test-user-123', provider: 'discount', display_name: 'החשבון של דנה', last_sync_at: null };
const cal = { id: 'c2', user_id: 'someone-else', provider: 'visaCalFast', display_name: 'כאל של אבי', last_sync_at: null };

// Latin words on screen, apart from what the tests put there as data or placeholders
const english = (allowed: string[] = []) =>
  (document.body.textContent?.match(/[A-Za-z]{2,}/g) ?? []).filter((w) => !['Ooga', 'SMS', ...allowed].includes(w));

describe('bank import in Hebrew', () => {
  beforeEach(() => {
    applyLanguage('he');
    listConnections.mockReset().mockResolvedValue([discount, cal]);
  });
  afterEach(() => applyLanguage('en'));

  it('offers the periods and the button the Hebrew guide names, for a bank', async () => {
    render(<BankImportModal onClose={() => {}} selectedConnectionId="c1" />);
    expect(await screen.findByText('החודש הנוכחי')).toBeInTheDocument();
    expect(screen.getByText('החודש הקודם')).toBeInTheDocument();
    expect(screen.getByText('טווח מותאם')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^ייבוא/ })).toBeInTheDocument();
    // Named under the account and in the note about logging in to it
    expect(screen.getAllByText('בנק דיסקונט')).toHaveLength(2);
    expect(english()).toEqual([]);
  });

  it('asks for the SMS code in Hebrew for Visa Cal', async () => {
    render(<BankImportModal onClose={() => {}} selectedConnectionId="c2" />);
    expect(await screen.findByRole('button', { name: /^שליחת קוד/ })).toBeInTheDocument();
    expect(screen.getByText('ויזה כאל (קוד ב־SMS)')).toBeInTheDocument();
    expect(english()).toEqual([]);
  });

  it('says so in Hebrew when nothing is connected yet', async () => {
    listConnections.mockResolvedValue([]);
    render(<BankImportModal onClose={() => {}} onAddAccount={() => {}} />);
    expect(await screen.findByText('אין חשבונות מקושרים')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'הוספת חשבון' })).toBeInTheDocument();
  });

  it('asks for each bank’s own Hebrew login terms', () => {
    render(<AddBankAccountModal onClose={() => {}} />);
    expect(screen.getByRole('button', { name: 'ישראכרט בקרוב' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'בנק דיסקונט' }));
    for (const label of ['תעודת זהות', 'סיסמה', 'קוד גישה', 'שם לתצוגה']) expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'בדיקה ושמירה' })).toBeInTheDocument();
    expect(english()).toEqual([]);
  });

  it('lists connected accounts in Hebrew', async () => {
    render(<ConnectedAccountsSettings />);
    expect(screen.getByText('חשבונות מקושרים')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'הוספת חשבון' })).toBeInTheDocument();
    expect(await screen.findByText('בנק דיסקונט · סנכרון אחרון: אף פעם')).toBeInTheDocument();
    expect(screen.getByText(/נוסף על ידי מישהו אחר במשק הבית/)).toBeInTheDocument();
    expect(english()).toEqual([]);
  });

  it('counts skipped duplicates with Hebrew plurals', () => {
    const { rerender } = render(<DuplicatesBubble count={1} />);
    expect(screen.getByRole('button', { name: 'כפילות אחת דולגה' })).toBeInTheDocument();
    rerender(<DuplicatesBubble count={3} />);
    expect(screen.getByRole('button', { name: '3 כפילויות דולגו' })).toBeInTheDocument();
  });
});
