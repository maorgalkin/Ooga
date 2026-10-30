import { describe, it, expect, afterEach } from 'vitest';
import { applyLanguage } from '../../src/i18n';
import { formatCurrency, formatCurrencyRounded } from '../../src/utils/formatCurrency';

// Intl marks Hebrew numbers with invisible direction characters and a no-break space; compare what's visible
const visible = (s: string) => s.replace(/[\u200e\u200f]/g, '').replace(/\u00a0/g, ' ');

describe('formatCurrency', () => {
  afterEach(() => applyLanguage('en'));

  it('keeps the existing English format', () => {
    expect(formatCurrency(1234, 'ILS')).toBe('₪1,234');
    expect(formatCurrencyRounded(12345, 'ILS')).toBe('₪12.3K');
    expect(formatCurrencyRounded(1500000, 'ILS')).toBe('₪1,500K');
  });

  it('formats the Israeli way on Hebrew screens, symbol after the number', () => {
    applyLanguage('he');
    expect(visible(formatCurrency(1234, 'ILS'))).toBe('1,234 ₪');
    expect(visible(formatCurrencyRounded(12345, 'ILS'))).toBe('12.3K ₪');
  });
});
