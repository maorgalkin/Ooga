import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useTranslation } from 'react-i18next';
import { applyLanguage } from '../../src/i18n';

const auth = vi.hoisted(() => ({ user: null as { id: string; user_metadata: Record<string, unknown> } | null }));
vi.mock('../../src/contexts/AuthContext', () => ({ useAuth: () => ({ user: auth.user }) }));

import { LanguageSync } from '../../src/i18n/LanguageSync';

function Bar() {
  const { t } = useTranslation();
  return <p>{t('nav.signOut')}</p>;
}

describe('LanguageSync', () => {
  afterEach(() => {
    auth.user = null;
    applyLanguage('en');
    localStorage.clear();
  });

  it("shows what mounts with the account's language, not the one the page had a moment before", () => {
    // Signing in on a page showing English, to an account set to Hebrew: the bar mounts in the
    // same moment the language switches, and used to miss it
    applyLanguage('en');
    auth.user = { id: 'u1', user_metadata: { language: 'he' } };
    render(<LanguageSync><Bar /></LanguageSync>);
    expect(screen.getByText('התנתקות')).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
  });

  it('renders straight away when the account and the page agree', () => {
    auth.user = { id: 'u1', user_metadata: {} };
    render(<LanguageSync><Bar /></LanguageSync>);
    expect(screen.getByText('Sign out')).toBeInTheDocument();
  });
});
