import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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
vi.mock('../../../src/contexts/AuthContext', () => ({
  useAuth: () => ({ user: null, loading: false, signIn }),
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
});
