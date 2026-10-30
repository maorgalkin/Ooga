import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ForgotPassword from '../../../src/pages/auth/ForgotPassword';
import ResetPassword from '../../../src/pages/auth/ResetPassword';

const auth = vi.hoisted(() => ({
  user: { id: 'user-1' } as { id: string } | null,
  loading: false,
  resetPassword: vi.fn(),
  updatePassword: vi.fn(),
}));
const navigate = vi.hoisted(() => vi.fn());

vi.mock('../../../src/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}));

const renderPage = (page: React.ReactElement) => render(<MemoryRouter>{page}</MemoryRouter>);

beforeEach(() => {
  auth.user = { id: 'user-1' };
  auth.resetPassword.mockReset().mockResolvedValue({ error: null });
  auth.updatePassword.mockReset().mockResolvedValue({ error: null });
  navigate.mockReset();
});

describe('ForgotPassword', () => {
  it('sends the reset email and says to check the inbox', async () => {
    renderPage(<ForgotPassword />);
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: ' dana@example.com ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Check your email');
    expect(auth.resetPassword).toHaveBeenCalledWith('dana@example.com');
  });

  it('shows an error when the email cannot be sent', async () => {
    auth.resetPassword.mockResolvedValue({ error: { message: 'rate limited' } });
    renderPage(<ForgotPassword />);
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'dana@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't send the reset email");
  });
});

describe('ResetPassword', () => {
  const fill = (password: string, confirm: string) => {
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: password } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: confirm } });
    fireEvent.click(screen.getByRole('button', { name: 'Save new password' }));
  };

  it('saves the new password and goes to the dashboard', async () => {
    renderPage(<ResetPassword />);
    fill('new-secret', 'new-secret');

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/', { replace: true }));
    expect(auth.updatePassword).toHaveBeenCalledWith('new-secret');
  });

  it("refuses passwords that don't match", () => {
    renderPage(<ResetPassword />);
    fill('new-secret', 'other-secret');

    expect(screen.getByRole('alert')).toHaveTextContent("The passwords don't match.");
    expect(auth.updatePassword).not.toHaveBeenCalled();
  });

  it('offers a new link when the reset link has expired', () => {
    auth.user = null;
    renderPage(<ResetPassword />);

    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Request a new link' })).toHaveAttribute('href', '/forgot-password');
  });
});
