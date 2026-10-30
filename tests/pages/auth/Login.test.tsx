import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import Login from '../../../src/pages/auth/Login';

// jsdom has no IntersectionObserver, which framer-motion's whileInView needs
vi.stubGlobal(
  'IntersectionObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

const signIn = vi.hoisted(() => vi.fn());
const auth = vi.hoisted(() => ({ user: null as { id: string } | null }));
vi.mock('../../../src/contexts/AuthContext', () => ({
  useAuth: () => ({ user: auth.user, loading: false, signIn }),
}));

function Landed() {
  const location = useLocation();
  return <p>landed on {location.pathname + location.search}</p>;
}

function renderLogin(from?: string) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/login', state: from ? { from } : undefined }]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Landed />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function submit() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Email'), 'dana@example.com');
  await user.type(screen.getByLabelText('Password'), 'secret1');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
}

describe('Login page', () => {
  beforeEach(() => {
    signIn.mockReset();
    signIn.mockResolvedValue({ error: null });
  });

  it('returns to the page the reader was heading to', async () => {
    renderLogin('/?tab=budget&subtab=categories');
    await submit();
    expect(await screen.findByText('landed on /?tab=budget&subtab=categories')).toBeInTheDocument();
  });

  it('goes to the Dashboard when there is nowhere to return to', async () => {
    renderLogin();
    await submit();
    expect(await screen.findByText('landed on /')).toBeInTheDocument();
  });

  it('ignores a return address on another site', async () => {
    renderLogin('//evil.example/phish');
    await submit();
    expect(await screen.findByText('landed on /')).toBeInTheDocument();
  });

  it('signs in with Enter, moving from the email to an empty password first', async () => {
    renderLogin();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email'), 'dana@example.com{Enter}');
    expect(screen.getByLabelText('Password')).toHaveFocus();
    expect(signIn).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText('Password'), 'secret1{Enter}');
    expect(signIn).toHaveBeenCalledWith('dana@example.com', 'secret1');
    expect(await screen.findByText('landed on /')).toBeInTheDocument();
  });

  it('signs in with Enter from the email field once the password is filled', async () => {
    renderLogin();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Password'), 'secret1');
    await user.type(screen.getByLabelText('Email'), 'dana@example.com{Enter}');
    expect(signIn).toHaveBeenCalledWith('dana@example.com', 'secret1');
  });

  it('introduces Ooga in three steps, then its maker', () => {
    renderLogin();
    expect(screen.getByRole('heading', { level: 2, name: 'Already on Ooga?' })).toBeInTheDocument();
    // The feature cards' headings come first
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent).slice(-3)).toEqual([
      'Set up your household', 'Build your budget', 'Track and adjust',
    ]);
    expect(screen.getByRole('heading', { name: "Who's behind Ooga" })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ready to budget?' })).toBeInTheDocument();
  });
});

describe('Login when already signed in', () => {
  beforeEach(() => {
    auth.user = { id: 'user-1' };
  });
  afterEach(() => {
    auth.user = null;
  });

  it('skips the form and goes to the app', () => {
    renderLogin();
    expect(screen.getByText('landed on /')).toBeInTheDocument();
    expect(screen.queryByLabelText('Password')).toBeNull();
  });

  it('goes where they were heading', () => {
    renderLogin('/?tab=budget');
    expect(screen.getByText('landed on /?tab=budget')).toBeInTheDocument();
  });
});
