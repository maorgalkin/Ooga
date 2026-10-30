import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import i18n, { applyLanguage, resolveLanguage } from '../../src/i18n';
import en from '../../src/i18n/locales/en.json';
import he from '../../src/i18n/locales/he.json';

const keys = (o: object, prefix = ''): string[] =>
  Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]));

describe('i18n', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.unstubAllEnvs();
    applyLanguage('en');
  });

  it('stays English while Hebrew is switched off, whatever was saved', () => {
    vi.stubEnv('VITE_ENABLE_HEBREW', '');
    localStorage.setItem('ooga.language', 'he');
    expect(resolveLanguage('he')).toBe('en');
  });

  it('prefers the account, then this browser, then English', () => {
    vi.stubEnv('VITE_ENABLE_HEBREW', '1');
    expect(resolveLanguage()).toBe('en');
    localStorage.setItem('ooga.language', 'he');
    expect(resolveLanguage()).toBe('he');
    expect(resolveLanguage('en')).toBe('en');
    expect(resolveLanguage('fr')).toBe('he');
  });

  it('turns the page right-to-left for Hebrew and remembers the choice', () => {
    applyLanguage('he');
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
    expect(document.documentElement).toHaveAttribute('lang', 'he');
    expect(i18n.language).toBe('he');
    expect(localStorage.getItem('ooga.language')).toBe('he');
    applyLanguage('en');
    expect(document.documentElement).toHaveAttribute('dir', 'ltr');
  });

  it('has a Hebrew text for every English key, and no keys English lacks', () => {
    // Gendered variants (_female/_male) are Hebrew-only; their neutral key must exist in both
    const hebrew = keys(he).map((k) => k.replace(/_(female|male)$/, ''));
    expect(new Set(hebrew)).toEqual(new Set(keys(en)));
  });
});
