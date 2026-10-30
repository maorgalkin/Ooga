import { describe, it, expect } from 'vitest';
import { safeReturnPath } from '../../src/utils/returnPath';

describe('safeReturnPath', () => {
  it('keeps in-app paths, including their query', () => {
    expect(safeReturnPath('/?tab=budget&subtab=settings')).toBe('/?tab=budget&subtab=settings');
  });

  it.each([undefined, null, 42, '', 'https://evil.example', '//evil.example', '/\\evil.example', '/\t/evil.example', 'tab=budget'])(
    'falls back to the Dashboard for %s',
    (from) => {
      expect(safeReturnPath(from)).toBe('/');
    },
  );
});
