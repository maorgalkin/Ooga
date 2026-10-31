import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BankImportModal from '../../src/components/BankImportModal';

const svc = vi.hoisted(() => ({ start: vi.fn(), wait: vi.fn(), onComplete: vi.fn(), reviewModes: [] as string[] }));

vi.mock('../../src/services/bankImportService', () => ({
  listConnections: vi.fn(async () => [{ id: 'c1', user_id: 'u1', provider: 'discount', display_name: 'Discount', last_sync_at: null }]),
  requestCalOtpForConnection: vi.fn(),
  importCalDirect: vi.fn(),
  fetchImportedTransactions: vi.fn(async () => []),
  deleteTransactions: vi.fn(),
}));
vi.mock('../../src/services/scraperService', () => ({ startServerImport: svc.start, waitForServerImport: svc.wait }));
vi.mock('../../src/services/reconcileService', () => ({ undoMergesForSession: vi.fn() }));
vi.mock('../../src/components/ImportReviewStep', () => ({
  default: ({ mode }: { mode: string }) => {
    svc.reviewModes.push(mode);
    return <p>review ({mode})</p>;
  },
}));

const finished = (result: Record<string, unknown>) => ({ sessionId: 'x', dbSessionId: 's1', status: 'complete', error: null, result });

describe('a bank import through the import service', () => {
  beforeEach(() => {
    svc.start.mockReset().mockResolvedValue('x');
    svc.wait.mockReset();
    svc.onComplete.mockReset();
    svc.reviewModes = [];
  });

  async function runImport() {
    render(<BankImportModal onClose={() => {}} onImportComplete={svc.onComplete} selectedConnectionId="c1" />);
    fireEvent.click(await screen.findByRole('button', { name: /^Import/ }));
  }

  it('opens the holding-area review when the service kept the rows for Import', async () => {
    svc.wait.mockResolvedValue(finished({ imported: 3, skipped: 1, duplicates: [], mode: 'staged' }));
    await runImport();
    expect(await screen.findByText('review (staged)')).toBeInTheDocument();
    // Nothing reached the budget yet
    expect(svc.onComplete).not.toHaveBeenCalled();
  });

  it('keeps today’s review with a service that wrote the rows already', async () => {
    svc.wait.mockResolvedValue(finished({ imported: 3, skipped: 1, duplicates: [] }));
    await runImport();
    expect(await screen.findByText('review (live)')).toBeInTheDocument();
    expect(svc.onComplete).toHaveBeenCalledWith(3);
  });
});
