import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../../src/contexts/AuthContext';
import ResetPassword from '../../../src/pages/auth/ResetPassword';

// The global setup mocks AuthContext; this suite needs the real provider and its event handling
vi.unmock('../../../src/contexts/AuthContext');

type AuthCallback = (event: string, session: unknown) => void;
const auth = vi.hoisted(() => ({ callback: null as AuthCallback | null }));
const session = { user: { id: 'user-1' } };
const otherSession = { user: { id: 'user-2' } };

vi.mock('../../../src/lib/supabase', () => ({
  supabase: {
    auth: {
      initialize: vi.fn(async () => ({ error: null })),
      getSession: vi.fn(async () => ({ data: { session } })),
      updateUser: vi.fn(async () => ({ error: null })),
      signOut: vi.fn(async () => ({ error: null })),
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

  it('does not carry the recovery over to a different user', async () => {
    renderPage();
    await screen.findByRole('link', { name: 'Request a new link' });

    act(() => auth.callback?.('PASSWORD_RECOVERY', session));
    act(() => auth.callback?.('SIGNED_IN', otherSession));

    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Request a new link' })).toBeInTheDocument();
  });

  it('ends the recovery on sign-out', async () => {
    renderPage();
    await screen.findByRole('link', { name: 'Request a new link' });

    act(() => auth.callback?.('PASSWORD_RECOVERY', session));
    act(() => auth.callback?.('SIGNED_OUT', null));

    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
  });

  it('ends the recovery once the new password is saved', async () => {
    renderPage();
    await screen.findByRole('link', { name: 'Request a new link' });
    act(() => auth.callback?.('PASSWORD_RECOVERY', session));

    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'new-secret' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'new-secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save new password' }));

    await waitFor(() => expect(screen.queryByLabelText('New password')).not.toBeInTheDocument());
    expect(screen.getByRole('link', { name: 'Request a new link' })).toBeInTheDocument();
  });
});
