import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Register from '../../../src/pages/auth/Register';

// jsdom has no IntersectionObserver, which framer-motion's whileInView needs
vi.stubGlobal(
  'IntersectionObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

const signUp = vi.hoisted(() => vi.fn());
const auth = vi.hoisted(() => ({ user: null as { id: string } | null }));
vi.mock('../../../src/contexts/AuthContext', () => ({
  useAuth: () => ({ user: auth.user, loading: false, signUp }),
}));

function renderRegister() {
  return render(
    <MemoryRouter initialEntries={['/register']}>
      <Register />
    </MemoryRouter>,
  );
}

async function fillForm(password = 'secret1', confirm = password) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('First name'), ' Dana ');
  await user.type(screen.getByLabelText('Last name'), 'Levi');
  await user.type(screen.getByLabelText('Email'), 'dana@example.com');
  await user.type(screen.getByLabelText('Password'), password);
  await user.type(screen.getByLabelText('Confirm password'), confirm);
  await user.click(screen.getByRole('button', { name: 'Create account' }));
}

describe('Register page', () => {
  beforeEach(() => {
    signUp.mockReset();
  });

  it('sits in the public layout with a link back to sign in', () => {
    renderRegister();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent("Start your family's budget");
    expect(screen.getByRole('heading', { level: 2, name: 'Create account' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'About' })[0]).toHaveAttribute('href', '/about');
    const signInLinks = screen.getAllByRole('link', { name: 'Sign in' });
    expect(signInLinks.every((link) => link.getAttribute('href') === '/login')).toBe(true);
  });

  it("explains a password mismatch and doesn't sign up", async () => {
    renderRegister();
    await fillForm('secret1', 'secret2');
    expect(screen.getByRole('alert')).toHaveTextContent(
      "The passwords don't match. Type the same password in both fields.",
    );
    expect(signUp).not.toHaveBeenCalled();
  });

  it('rejects a short password', async () => {
    renderRegister();
    await fillForm('abc');
    expect(screen.getByRole('alert')).toHaveTextContent('Use a password of at least 6 characters.');
    expect(signUp).not.toHaveBeenCalled();
  });

  it('signs up with trimmed names and asks the person to check their email', async () => {
    signUp.mockResolvedValue({ error: null });
    renderRegister();
    await fillForm();
    expect(signUp).toHaveBeenCalledWith('dana@example.com', 'secret1', 'Dana', 'Levi');
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
    expect(screen.getByText('dana@example.com')).toBeInTheDocument();
  });

  it('shows the sign-up error inline', async () => {
    signUp.mockResolvedValue({ error: { message: 'User already registered' } });
    renderRegister();
    await fillForm();
    expect(await screen.findByRole('alert')).toHaveTextContent('User already registered');
    expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled();
  });
});

describe('Register when already signed in', () => {
  afterEach(() => {
    auth.user = null;
  });

  it('skips the form and goes to the app', () => {
    auth.user = { id: 'user-1' };
    render(
      <MemoryRouter initialEntries={['/register']}>
        <Routes>
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<p>the app</p>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('the app')).toBeInTheDocument();
    expect(screen.queryByLabelText('First name')).toBeNull();
  });
});
