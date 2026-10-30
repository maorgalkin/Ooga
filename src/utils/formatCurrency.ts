/**
 * Currency Formatting Utilities
 * Centralized formatting that respects user preferences for rounded amounts
 */

import type { GlobalBudgetSettings } from '../types/budget';
import { getMoneyLocale } from './locale';

/**
 * Format currency amount according to user preferences
 * @param amount - The numeric amount to format
 * @param currency - Currency code (e.g., 'USD', 'EUR', 'ILS')
 * @param showRounded - Whether to show rounded amounts (no decimals)
 * @returns Formatted currency string
 */
export function formatCurrency(
  amount: number, 
  currency: string = 'USD', 
  showRounded: boolean = true
): string {
  return new Intl.NumberFormat(getMoneyLocale(), {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: showRounded ? 0 : 2,
    maximumFractionDigits: showRounded ? 0 : 2,
  }).format(showRounded ? Math.round(amount) : amount);
}

/** The parts of the budget's global settings that money formatting reads. */
export type CurrencySettings = Partial<Pick<GlobalBudgetSettings, 'currency' | 'showRoundedAmounts'>>;

/**
 * Format currency using global budget settings
 * @param amount - The numeric amount to format
 * @param globalSettings - Global budget settings (only `currency` and `showRoundedAmounts` are read)
 * @returns Formatted currency string
 */
export function formatCurrencyFromSettings(
  amount: number,
  globalSettings?: CurrencySettings
): string {
  const currency = globalSettings?.currency || 'USD';
  const showRounded = globalSettings?.showRoundedAmounts ?? true;
  return formatCurrency(amount, currency, showRounded);
}

/**
 * Format currency with K notation for large values (for charts)
 * @param amount - The numeric amount to format
 * @param currency - Currency code (e.g., 'USD', 'EUR', 'ILS')
 * @param showRounded - Whether to show rounded amounts
 * @returns Formatted currency string with K notation if >= 1000
 */
export function formatCurrencyRounded(
  amount: number,
  currency: string = 'USD',
  showRounded: boolean = true
): string {
  const locale = getMoneyLocale();
  // Use K notation for values >= 1000
  if (amount >= 1000) {
    // Hebrew puts the ₪ after the number, so a "K" appended by hand would land after the symbol
    if (locale !== 'en-US') {
      return new Intl.NumberFormat(locale, { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(amount);
    }
    const kValue = amount / 1000;
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(kValue) + 'K';
  }
  
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: showRounded ? 0 : 2,
    maximumFractionDigits: showRounded ? 0 : 2,
  }).format(showRounded ? Math.round(amount) : amount);
}

/**
 * Get currency symbol for a given currency code
 * @param currency - Currency code (e.g., 'USD', 'EUR', 'ILS')
 * @returns Currency symbol
 */
export function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    ILS: '₪',
    JPY: '¥',
  };
  return symbols[currency] || currency;
}
