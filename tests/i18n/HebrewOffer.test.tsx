import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n, { applyLanguage } from '../../src/i18n';

const auth = vi.hoisted(() => ({ user: null as { id: string; user_metadata: Record<string, unknown> } | null }));
vi.mock('../../src/contexts/AuthContext', () => ({ useAuth: () => ({ user: auth.user }) }));
const savePreferences = vi.hoisted(() => vi.fn());
vi.mock('../../src/services/preferencesService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/services/preferencesService')>()),
  savePreferences,
}));

import { HebrewOffer } from '../../src/i18n/HebrewOffer';

const browserLanguages = (languages: string[]) =>
  vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(languages);

describe('HebrewOffer', () => {
  beforeEach(() => {
    localStorage.clear();
    auth.user = null;
    savePreferences.mockReset().mockResolvedValue(undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    applyLanguage('en');
    localStorage.clear();
  });

  it('offers Hebrew, in Hebrew, to a Hebrew browser that hasn\'t chosen', () => {
    browserLanguages(['he-IL', 'en-US']);
    render(<HebrewOffer />);
    expect(screen.getByRole('region', { name: 'Ooga בעברית' })).toHaveTextContent('Ooga זמינה גם בעברית.');
  });

  it('stays away from other browsers, and from anyone who already chose', () => {
    browserLanguages(['en-US']);
    const { unmount } = render(<HebrewOffer />);
    expect(screen.queryByRole('region')).toBeNull();
    unmount();

    browserLanguages(['he-IL']);
    localStorage.setItem('ooga.language', 'en');
    const second = render(<HebrewOffer />);
    expect(screen.queryByRole('region')).toBeNull();
    second.unmount();

    localStorage.clear();
    auth.user = { id: 'u1', user_metadata: { language: 'he' } };
    render(<HebrewOffer />);
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('switches to Hebrew and saves it to the account when accepted', async () => {
    browserLanguages(['he-IL']);
    auth.user = { id: 'u1', user_metadata: {} };
    render(<HebrewOffer />);
    await userEvent.click(screen.getByRole('button', { name: 'מעבר לעברית' }));
    expect(i18n.language).toBe('he');
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
    expect(savePreferences).toHaveBeenCalledWith({ language: 'he' });
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('remembers "keep English" on this browser without writing the account', async () => {
    browserLanguages(['he-IL']);
    auth.user = { id: 'u1', user_metadata: {} };
    render(<HebrewOffer />);
    await userEvent.click(screen.getByRole('button', { name: 'להמשיך באנגלית' }));
    expect(i18n.language).toBe('en');
    expect(localStorage.getItem('ooga.language')).toBe('en');
    expect(savePreferences).not.toHaveBeenCalled();
    expect(screen.queryByRole('region')).toBeNull();
  });
});
