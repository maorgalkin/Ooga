import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';

vi.mock('../../src/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
const pending = vi.hoisted(() => ({ resolve: (() => {}) as (transactions: unknown[]) => void }));
vi.mock('../../src/services/supabaseDataService', () => ({
  getTransactions: () => new Promise((r) => { pending.resolve = r; }),
  getFamilyMembers: () => Promise.resolve([]),
}));

import { FinanceProvider, useFinance } from '../../src/context/FinanceContext';

function Probe() {
  const { hasLoaded, transactions } = useFinance();
  return <p>{hasLoaded ? `loaded ${transactions.length}` : 'loading'}</p>;
}

describe('FinanceContext', () => {
  it("tells loading apart from having no transactions", async () => {
    render(<FinanceProvider><Probe /></FinanceProvider>);
    expect(screen.getByText('loading')).toBeInTheDocument();
    await act(async () => pending.resolve([]));
    expect(screen.getByText('loaded 0')).toBeInTheDocument();
  });
});
