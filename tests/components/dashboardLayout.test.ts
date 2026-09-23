import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { initialLayoutMode, resolveLayout } from '../../src/components/dashboard/layoutMode';
import { useMediaQuery } from '../../src/hooks/useMediaQuery';

describe('resolveLayout', () => {
  it('uses tiled on desktop and wide on phones in auto mode (production)', () => {
    expect(resolveLayout('auto', true)).toBe('tiled');
    expect(resolveLayout('auto', false)).toBe('wide');
  });

  it('respects an explicit dev choice on any screen size', () => {
    expect(resolveLayout('both', false)).toBe('both');
    expect(resolveLayout('wide', true)).toBe('wide');
    expect(resolveLayout('tiled', false)).toBe('tiled');
  });
});

describe('initialLayoutMode', () => {
  it('ignores any saved choice in production', () => {
    expect(initialLayoutMode('both', false)).toBe('auto');
    expect(initialLayoutMode('wide', false)).toBe('auto');
  });

  it('restores a valid saved choice in development', () => {
    expect(initialLayoutMode('both', true)).toBe('both');
    expect(initialLayoutMode(null, true)).toBe('auto');
    expect(initialLayoutMode('something-old', true)).toBe('auto');
  });
});

describe('useMediaQuery', () => {
  const listeners = new Set<() => void>();
  let matches = false;

  const mockMatchMedia = () => {
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      get matches() { return matches; },
      media: query,
      addEventListener: (_: string, cb: () => void) => listeners.add(cb),
      removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
    })));
  };

  afterEach(() => {
    vi.unstubAllGlobals();
    listeners.clear();
  });

  it('reflects the current match and follows changes', () => {
    matches = true;
    mockMatchMedia();
    const { result, unmount } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(true);

    act(() => {
      matches = false;
      listeners.forEach(cb => cb());
    });
    expect(result.current).toBe(false);

    unmount();
    expect(listeners.size).toBe(0);
  });
});
