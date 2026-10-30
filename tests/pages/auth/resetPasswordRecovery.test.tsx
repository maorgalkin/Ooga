import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../../src/contexts/AuthContext';
import ResetPassword from '../../../src/pages/auth/ResetPassword';

// The global setup mocks AuthContext; this suite needs the real provider and its event handling
vi.unmock('../../../src/contexts/AuthContext');

type AuthCallback = (event: string, session: unknown) => void;
const auth = vi.hoisted(() => ({ callback: null as AuthCallback | null }));
const session = { user: { id: 'user-1' } };

vi.mock('../../../src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session } })),
      onAuthStateChange: vi.fn((cb: AuthCallback) => {
        auth.callback = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
    },
  },
}));

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/reset-password']}>
      <AuthProvider>
        <ResetPassword />
      </AuthProvider>
    </MemoryRouter>
  );

describe('ResetPassword with the real AuthProvider', () => {
  beforeEach(() => { auth.callback = null; });

  it('does not show the form to someone who is just signed in', async () => {
    renderPage();

    expect(await screen.findByRole('link', { name: 'Request a new link' })).toBeInTheDocument();
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
  });

  it('shows the form once Supabase reports the session came from a reset link', async () => {
    renderPage();
    await screen.findByRole('link', { name: 'Request a new link' });

    act(() => auth.callback?.('PASSWORD_RECOVERY', session));

    expect(screen.getByLabelText('New password')).toBeInTheDocument();
  });
});
