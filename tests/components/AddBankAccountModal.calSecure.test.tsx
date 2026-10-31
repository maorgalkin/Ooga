import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AddBankAccountModal from '../../src/components/AddBankAccountModal';

const svc = vi.hoisted(() => ({ addSecure: vi.fn(), add: vi.fn(), remove: vi.fn() }));
vi.mock('../../src/services/scraperService', () => ({ addSecureConnection: svc.addSecure }));
vi.mock('../../src/services/bankImportService', () => ({ addConnection: svc.add, deleteConnection: svc.remove }));

async function addCal() {
  render(<AddBankAccountModal onClose={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: /Visa Cal \(SMS code\)/ }));
  fireEvent.change(screen.getByPlaceholderText('123456789'), { target: { value: '123456782' } });
  fireEvent.change(screen.getByPlaceholderText('1234'), { target: { value: '4321' } });
  fireEvent.click(screen.getByRole('button', { name: /save/i }));
}

describe('adding a Visa Cal account', () => {
  beforeEach(() => {
    for (const fn of Object.values(svc)) fn.mockReset();
    svc.add.mockResolvedValue({});
    svc.remove.mockResolvedValue(undefined);
  });

  it('keeps the ID only on the import service when it holds it securely', async () => {
    svc.addSecure.mockResolvedValue({ id: 'c1', provider: 'visaCalFast', display_name: 'Cal', secure: true });
    await addCal();
    await waitFor(() => expect(svc.addSecure).toHaveBeenCalled());
    expect(svc.addSecure.mock.calls[0][1]).toEqual({ id: '123456782', last4Digits: '4321' });
    expect(svc.remove).not.toHaveBeenCalled();
    expect(svc.add).not.toHaveBeenCalled();
  });

  it('falls back to the older way with an import service from before the change', async () => {
    svc.addSecure.mockResolvedValue({ id: 'c1', provider: 'visaCalFast', display_name: 'Cal', secure: false });
    await addCal();
    await waitFor(() => expect(svc.add).toHaveBeenCalled());
    expect(svc.remove).toHaveBeenCalledWith('c1');
    expect(svc.add.mock.calls[0][0]).toBe('visaCalFast');
  });
});
