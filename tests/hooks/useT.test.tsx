import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { renderHook } from '@testing-library/react';
import i18n, { applyLanguage } from '../../src/i18n';

const auth = vi.hoisted(() => ({ meta: {} as Record<string, unknown> }));
vi.mock('../../src/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', user_metadata: auth.meta } }),
}));

import { useT } from '../../src/hooks/useT';

describe('useT', () => {
  beforeAll(() => {
    i18n.addResources('he', 'translation', {
      'test.add': 'הוספת הוצאה',
      'test.add_female': 'הוסיפי הוצאה',
      'test.add_male': 'הוסף הוצאה',
      'test.neutralOnly': 'שמירה',
    });
    applyLanguage('he');
  });
  afterAll(() => applyLanguage('en'));

  it('uses the variant for how the person asked to be addressed', () => {
    auth.meta = { address_as: 'female' };
    expect(renderHook(() => useT()).result.current('test.add')).toBe('הוסיפי הוצאה');
    auth.meta = { address_as: 'male' };
    expect(renderHook(() => useT()).result.current('test.add')).toBe('הוסף הוצאה');
  });

  it('falls back to the neutral wording when unset or when a key has no variant', () => {
    auth.meta = {};
    expect(renderHook(() => useT()).result.current('test.add')).toBe('הוספת הוצאה');
    auth.meta = { address_as: 'female' };
    expect(renderHook(() => useT()).result.current('test.neutralOnly')).toBe('שמירה');
  });
});
