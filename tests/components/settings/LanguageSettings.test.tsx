import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { applyLanguage } from '../../../src/i18n';

const savePreferences = vi.hoisted(() => vi.fn());
vi.mock('../../../src/services/preferencesService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/services/preferencesService')>()),
  savePreferences,
}));

import { LanguageSettings } from '../../../src/components/settings/LanguageSettings';

describe('LanguageSettings', () => {
  beforeEach(() => savePreferences.mockReset().mockResolvedValue(undefined));
  afterEach(() => applyLanguage('en'));

  it('switches to Hebrew right away and saves it to the account', async () => {
    render(<LanguageSettings />);
    expect(screen.queryByRole('radiogroup')).toBeNull();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Language' }), 'he');
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
    expect(savePreferences).toHaveBeenCalledWith({ language: 'he' });
    // The card itself is now in Hebrew, with the form of address to choose from
    expect(await screen.findByRole('radiogroup', { name: 'פנייה בעברית' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'ניטרלי' })).toHaveAttribute('aria-checked', 'true');
  });

  it('saves the form of address, and goes back to it if saving fails', async () => {
    applyLanguage('he');
    render(<LanguageSettings />);
    await userEvent.click(screen.getByRole('radio', { name: 'לשון נקבה' }));
    expect(savePreferences).toHaveBeenLastCalledWith({ addressAs: 'female' });
    expect(screen.getByRole('radio', { name: 'לשון נקבה' })).toHaveAttribute('aria-checked', 'true');

    savePreferences.mockRejectedValueOnce(new Error('offline'));
    await userEvent.click(screen.getByRole('radio', { name: 'ניטרלי' }));
    expect(savePreferences).toHaveBeenLastCalledWith({ addressAs: null });
    expect(await screen.findByRole('alert')).toHaveTextContent('הבחירה לא נשמרה. כדאי לבדוק את החיבור ולנסות שוב.');
    await waitFor(() => expect(screen.getByRole('radio', { name: 'לשון נקבה' })).toHaveAttribute('aria-checked', 'true'));
  });
});
