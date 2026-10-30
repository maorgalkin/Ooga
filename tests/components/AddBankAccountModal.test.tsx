import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AddBankAccountModal from '../../src/components/AddBankAccountModal';

vi.mock('../../src/services/bankImportService', () => ({ addConnection: vi.fn() }));
vi.mock('../../src/services/scraperService', () => ({ addSecureConnection: vi.fn() }));

describe('AddBankAccountModal', () => {
  it('only lets you pick the providers whose imports work', () => {
    render(<AddBankAccountModal onClose={() => {}} />);

    expect(screen.getByRole('button', { name: 'Discount Bank' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Visa Cal (SMS code)' })).toBeEnabled();

    for (const name of ['Visa Cal (username)', 'Isracard', 'Max (Leumi Card)', 'Amex Israel', 'Bank Hapoalim', 'Bank Leumi']) {
      expect(screen.getByRole('button', { name: `${name} Coming soon` })).toBeDisabled();
    }
  });
});
