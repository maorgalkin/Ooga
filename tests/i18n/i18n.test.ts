import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import i18n, { applyLanguage, resolveLanguage } from '../../src/i18n';
import en from '../../src/i18n/locales/en.json';
import he from '../../src/i18n/locales/he.json';
import guideEn from '../../src/i18n/locales/guide.en.json';
import guideHe from '../../src/i18n/locales/guide.he.json';

// Arrays (a guide step's paragraphs) count as one key with their length, so Hebrew can't drop a paragraph
const keys = (o: object, prefix = ''): string[] =>
  Object.entries(o).flatMap(([k, v]) =>
    Array.isArray(v) ? [`${prefix}${k}[${v.length}]`] : typeof v === 'object' ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );

describe('i18n', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => applyLanguage('en'));

  it('prefers the account, then this browser, then English', () => {
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
    // Gendered variants (_female/_male) are Hebrew-only, and each language has its own plural forms
    // (Hebrew has _two): compare what's left once those suffixes are off
    const base = (k: string) => k.replace(/_(female|male)$/, '').replace(/_(zero|one|two|few|many|other)$/, '');
    expect(new Set(keys(he).map(base))).toEqual(new Set(keys(en).map(base)));
  });

  it('has the guide in Hebrew in the same shape, paragraph for paragraph', () => {
    expect(new Set(keys(guideHe))).toEqual(new Set(keys(guideEn)));
  });
});
