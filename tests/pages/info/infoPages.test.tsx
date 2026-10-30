import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AboutPage from '../../../src/pages/info/AboutPage';
import GuidePage from '../../../src/pages/info/GuidePage';
import { GUIDE_CHAPTERS, GUIDE_PARTS } from '../../../src/content/guide';

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
  it('opens with a welcome page that lays out the four parts', () => {
    renderAt('/guide');
    expect(screen.getByRole('heading', { level: 1, name: 'Less to learn than it looks' })).toBeInTheDocument();
    for (const part of GUIDE_PARTS) {
      expect(screen.getByRole('heading', { level: 2, name: part.title })).toBeInTheDocument();
    }
    expect(screen.getByRole('link', { name: /Start with part 1/ })).toHaveAttribute('href', `/guide/${GUIDE_PARTS[0].chapters[0]}`);
  });

  it('puts every chapter in exactly one part, in reading order', () => {
    expect(GUIDE_PARTS.flatMap((p) => p.chapters)).toEqual(GUIDE_CHAPTERS.map((c) => c.slug));
  });

  it('links steps only to places the app can open', () => {
    const tabs = ['dashboard', 'transactions', 'budget', 'insights'];
    for (const step of GUIDE_CHAPTERS.flatMap((c) => c.steps)) {
      if (!step.link) continue;
      const url = new URL(step.link.to, 'https://haooga.com');
      expect(['/', '/register']).toContain(url.pathname);
      const tab = url.searchParams.get('tab');
      if (tab) expect(tabs).toContain(tab);
      const subtab = url.searchParams.get('subtab');
      if (subtab) expect(['categories', 'settings']).toContain(subtab);
    }
  });

  it('shows a chapter with its part and links to its neighbours', () => {
    const [first, second, third] = GUIDE_CHAPTERS;
    renderAt(`/guide/${second.slug}`);
    expect(screen.getByRole('heading', { level: 1, name: second.title })).toBeInTheDocument();
    expect(within(screen.getByRole('article')).getByText('Your budget')).toBeInTheDocument();
    const pager = screen.getByRole('navigation', { name: 'Chapter navigation' });
    expect(pager.querySelector(`a[href="/guide/${first.slug}"]`)).not.toBeNull();
    expect(pager.querySelector(`a[href="/guide/${third.slug}"]`)).not.toBeNull();
    expect(screen.getByRole('link', { name: new RegExp(second.title) })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Create budget' })).toHaveAttribute('href', '/?tab=budget&create=true');
  });

  it('sends unknown chapters back to the overview', () => {
    renderAt('/guide/not-a-chapter');
    expect(screen.getByRole('heading', { level: 1, name: 'Less to learn than it looks' })).toBeInTheDocument();
  });
});
