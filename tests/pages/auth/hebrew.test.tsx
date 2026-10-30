import React from 'react';
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { applyLanguage } from '../../../src/i18n';
import Login from '../../../src/pages/auth/Login';
import Register from '../../../src/pages/auth/Register';
import ForgotPassword from '../../../src/pages/auth/ForgotPassword';
import ResetPassword from '../../../src/pages/auth/ResetPassword';

// jsdom has no IntersectionObserver, which framer-motion's whileInView needs
vi.stubGlobal(
  'IntersectionObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

const auth = vi.hoisted(() => ({
  user: null as { id: string } | null,
  loading: false,
  isRecovery: true,
  awaitingRecovery: false,
  signIn: vi.fn(),
  signUp: vi.fn(),
  resetPassword: vi.fn(),
  updatePassword: vi.fn(),
}));
vi.mock('../../../src/contexts/AuthContext', () => ({ useAuth: () => auth }));

const renderPage = (page: React.ReactElement) => render(<MemoryRouter>{page}</MemoryRouter>);

// Latin words left in a translated area, apart from the brand name
const englishIn = (el: HTMLElement) => (el.textContent ?? '').match(/[A-Za-z]{2,}/g)?.filter((w) => w !== 'Ooga') ?? [];

describe('sign-in pages in Hebrew', () => {
  beforeAll(() => applyLanguage('he'));
  afterAll(() => applyLanguage('en'));

  it('signs in in Hebrew, with Supabase errors put in its own words', async () => {
    auth.signIn.mockResolvedValue({ error: { code: 'invalid_credentials', message: 'Invalid login credentials' } });
    renderPage(<Login />);
    const form = screen.getByRole('button', { name: 'התחברות' }).closest('form')!;
    await userEvent.type(within(form).getByLabelText('אימייל'), 'dana@example.com');
    await userEvent.type(within(form).getByLabelText('סיסמה'), 'wrong');
    await userEvent.click(within(form).getByRole('button', { name: 'התחברות' }));
    expect(await screen.findByText('האימייל או הסיסמה לא נכונים. כדאי לבדוק ולנסות שוב.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'כבר ב־Ooga?' })).toBeInTheDocument();
  });

  it('leaves no English on the create-account card', async () => {
    renderPage(<Register />);
    const card = screen.getByRole('heading', { level: 2, name: 'יצירת חשבון' }).parentElement!.parentElement!;
    await userEvent.type(screen.getByLabelText('שם פרטי'), 'דנה');
    await userEvent.type(screen.getByLabelText('שם משפחה'), 'לוי');
    await userEvent.type(screen.getByLabelText('אימייל'), 'dana@example.com');
    await userEvent.type(screen.getByLabelText('סיסמה'), 'secret1');
    await userEvent.type(screen.getByLabelText('אימות סיסמה'), 'secret2');
    await userEvent.click(screen.getByRole('button', { name: 'יצירת חשבון' }));
    expect(screen.getByRole('alert')).toHaveTextContent('הסיסמאות לא תואמות. צריך להקליד את אותה סיסמה בשני השדות.');
    expect(englishIn(card)).toEqual([]);
  });

  it('leaves no English on the forgot-password and reset-password pages', () => {
    const forgot = renderPage(<ForgotPassword />);
    expect(screen.getByRole('heading', { name: 'איפוס סיסמה' })).toBeInTheDocument();
    expect(englishIn(forgot.container)).toEqual([]);
    forgot.unmount();

    auth.user = { id: 'user-1' };
    const reset = renderPage(<ResetPassword />);
    expect(screen.getByLabelText('סיסמה חדשה')).toBeInTheDocument();
    expect(englishIn(reset.container)).toEqual([]);
    auth.user = null;
  });
});
