import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const unfinished = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('../../../src/services/bankImportService', () => ({ listUnfinishedImports: unfinished.list }));
vi.mock('../../../src/context/FinanceContext', () => ({ useFinance: () => ({ refreshTransactions: vi.fn() }) }));
vi.mock('../../../src/components/BankImportModal', () => ({
  default: ({ resumeSessionId }: { resumeSessionId: string }) => <div role="dialog">reviewing {resumeSessionId}</div>,
}));

import { UnfinishedImportsBanner } from '../../../src/components/dashboard/UnfinishedImportsBanner';
import { notifyImportsChanged } from '../../../src/hooks/useUnfinishedImports';

function renderBanner() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><UnfinishedImportsBanner /></QueryClientProvider>);
}

describe('UnfinishedImportsBanner', () => {
  beforeEach(() => unfinished.list.mockReset());

  it('lists postponed imports and reopens one for review', async () => {
    unfinished.list.mockResolvedValue([{ id: 'session-1', startedAt: '2026-10-30T08:00:00Z', connectionName: 'Visa Cal', rows: 12 }]);
    renderBanner();
    expect(await screen.findByText(/12 transactions from Visa Cal are waiting for your decision/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('reviewing session-1');
  });

  it('shows nothing when no import is waiting, and checks again when an import changes', async () => {
    unfinished.list.mockResolvedValue([]);
    renderBanner();
    await vi.waitFor(() => expect(unfinished.list).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('region')).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 20)); // let the first load settle
    notifyImportsChanged();
    await vi.waitFor(() => expect(unfinished.list).toHaveBeenCalledTimes(2));
  });
});
