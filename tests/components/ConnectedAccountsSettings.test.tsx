import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ConnectedAccountsSettings from '../../src/components/ConnectedAccountsSettings';

const { deleteConnection } = vi.hoisted(() => ({ deleteConnection: vi.fn() }));

vi.mock('../../src/services/bankImportService', () => ({
  listConnections: vi.fn(async () => [
    { id: 'conn-1', user_id: 'test-user-123', provider: 'discount', display_name: 'Discount Bank', last_sync_at: null },
  ]),
  deleteConnection,
}));

describe('ConnectedAccountsSettings', () => {
  it('shows an inline error when an account cannot be removed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    deleteConnection.mockRejectedValue(new Error('Failed to fetch'));
    render(<ConnectedAccountsSettings />);

    fireEvent.click(await screen.findByTitle('Remove connection'));

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't remove this account. Try again in a minute.");
    expect(window.alert).not.toHaveBeenCalled();
  });
});
