import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AboutPage from '../../../src/pages/info/AboutPage';
import GuidePage from '../../../src/pages/info/GuidePage';
import { GUIDE_CHAPTERS } from '../../../src/content/guide';

// jsdom has no IntersectionObserver, which framer-motion's whileInView needs
vi.stubGlobal(
  'IntersectionObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

// These pages are public, so check them both signed in and signed out.
const auth = vi.hoisted(() => ({ user: null as { id: string } | null }));
vi.mock('../../../src/contexts/AuthContext', () => ({
  useAuth: () => ({ user: auth.user, loading: false }),
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/about" element={<AboutPage />} />
        <Route path="/guide" element={<GuidePage />} />
        <Route path="/guide/:chapter" element={<GuidePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('About page', () => {
  beforeEach(() => {
    auth.user = null;
  });

  it('explains Ooga and offers the guide and account creation when signed out', () => {
    renderAt('/about');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('See where your money goes');
    expect(screen.getByRole('link', { name: 'Getting started guide' })).toHaveAttribute('href', '/guide');
    expect(screen.getByRole('link', { name: 'Create account' })).toHaveAttribute('href', '/register');
    expect(screen.getAllByRole('link', { name: 'Sign in' })[0]).toHaveAttribute('href', '/login');
  });

  it('points signed-in people back to the app', () => {
    auth.user = { id: 'test-user-123' };
    renderAt('/about');
    expect(screen.queryByRole('link', { name: 'Create account' })).toBeNull();
    expect(screen.getAllByRole('link', { name: 'Open Ooga' })[0]).toHaveAttribute('href', '/');
  });
});

describe('Guide page', () => {
  it('lists every chapter on the overview', () => {
    renderAt('/guide');
    expect(screen.getByRole('heading', { level: 1, name: 'Getting started with Ooga' })).toBeInTheDocument();
    for (const chapter of GUIDE_CHAPTERS) {
      expect(screen.getByRole('heading', { level: 2, name: chapter.title })).toBeInTheDocument();
    }
  });

  it('shows a chapter with links to its neighbours', () => {
    const [first, second, third] = GUIDE_CHAPTERS;
    renderAt(`/guide/${second.slug}`);
    expect(screen.getByRole('heading', { level: 1, name: second.title })).toBeInTheDocument();
    const pager = screen.getByRole('navigation', { name: 'Chapter navigation' });
    expect(pager.querySelector(`a[href="/guide/${first.slug}"]`)).not.toBeNull();
    expect(pager.querySelector(`a[href="/guide/${third.slug}"]`)).not.toBeNull();
    expect(screen.getByRole('link', { name: new RegExp(second.title) })).toHaveAttribute('aria-current', 'page');
  });

  it('sends unknown chapters back to the overview', () => {
    renderAt('/guide/not-a-chapter');
    expect(screen.getByRole('heading', { level: 1, name: 'Getting started with Ooga' })).toBeInTheDocument();
  });
});
