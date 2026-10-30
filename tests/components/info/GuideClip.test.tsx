import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GuideClip, type ClipFrame } from '../../../src/components/info/GuideClip';

vi.stubGlobal(
  'IntersectionObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

const desktop: ClipFrame[] = [{ src: '/guide/budget/tab.webp', size: { w: 1280, h: 800 } }];
const phone: ClipFrame[] = [{ src: '/guide/mobile/budget/tab.webp', size: { w: 390, h: 546 } }];

function setPhone(matches: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

const shownSrc = () => screen.getByRole('img', { name: 'Budget tab' }).querySelector('img')?.getAttribute('src');

describe('GuideClip', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the phone screenshots on a phone', () => {
    setPhone(true);
    render(<GuideClip frames={desktop} mobileFrames={phone} alt="Budget tab" />);
    expect(shownSrc()).toBe('/guide/mobile/budget/tab.webp');
  });

  it('shows the desktop screenshots on wider screens', () => {
    setPhone(false);
    render(<GuideClip frames={desktop} mobileFrames={phone} alt="Budget tab" />);
    expect(shownSrc()).toBe('/guide/budget/tab.webp');
  });

  it('falls back to desktop on a phone when a step has no phone set', () => {
    setPhone(true);
    render(<GuideClip frames={desktop} alt="Budget tab" />);
    expect(shownSrc()).toBe('/guide/budget/tab.webp');
  });
});
