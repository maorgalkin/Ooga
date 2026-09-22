/**
 * Exchange rates for converting foreign-currency transactions into the budget currency.
 *
 * Sources (both open source, free, no API key, CORS-enabled):
 * 1. Frankfurter — European Central Bank reference rates (~30 major currencies, incl. ILS).
 *    Weekends/holidays resolve to the previous business day. https://frankfurter.dev
 * 2. fawazahmed0/currency-api via jsDelivr — 200+ currencies, daily. Used when Frankfurter
 *    doesn't cover a currency or is unreachable. https://github.com/fawazahmed0/exchange-api
 *
 * Rates are estimates for budgeting, not accounting: the card's actual charge replaces them
 * once billed (see calDirectService).
 */

export interface ExchangeRate {
  rate: number;      // 1 unit of `from` = `rate` units of `to`
  rateDate: string;  // Date the rate was published for (YYYY-MM-DD)
  source: 'ECB' | 'currency-api' | 'identity';
}

const SYMBOL_TO_CODE: Record<string, string> = {
  '$': 'USD', 'US$': 'USD', '€': 'EUR', '£': 'GBP', '₪': 'ILS', 'NIS': 'ILS', '¥': 'JPY',
  'CHF': 'CHF', 'C$': 'CAD', 'A$': 'AUD',
};

// ISO 4217 numeric codes Cal may send instead of a symbol
const NUMERIC_TO_CODE: Record<string, string> = {
  '376': 'ILS', '840': 'USD', '978': 'EUR', '826': 'GBP', '392': 'JPY', '756': 'CHF',
  '124': 'CAD', '036': 'AUD', '36': 'AUD', '203': 'CZK', '208': 'DKK', '578': 'NOK', '752': 'SEK',
  '348': 'HUF', '985': 'PLN', '949': 'TRY', '818': 'EGP', '400': 'JOD', '784': 'AED', '764': 'THB',
};

/** ISO 4217 code for a currency symbol or code ('$', '€', '₪', 'usd', '376', …), or null if unknown */
export function toCurrencyCode(symbolOrCode: string | null | undefined): string | null {
  const value = symbolOrCode?.trim();
  if (!value) return null;
  if (SYMBOL_TO_CODE[value]) return SYMBOL_TO_CODE[value];
  if (NUMERIC_TO_CODE[value]) return NUMERIC_TO_CODE[value];
  if (/^[a-z]{3}$/i.test(value)) return value.toUpperCase();
  return null;
}

const cache = new Map<string, Promise<ExchangeRate>>();

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
  return res.json();
}

async function fromFrankfurter(from: string, to: string, date: string): Promise<ExchangeRate> {
  const body = await fetchJson(`https://api.frankfurter.dev/v1/${date}?base=${from}&symbols=${to}`) as
    { date?: string; rates?: Record<string, number> };
  const rate = body.rates?.[to];
  if (typeof rate !== 'number') throw new Error(`Frankfurter has no ${from}→${to} rate`);
  return { rate, rateDate: body.date ?? date, source: 'ECB' };
}

async function fromCurrencyApi(from: string, to: string, date: string): Promise<ExchangeRate> {
  const base = from.toLowerCase();
  const version = date === 'latest' ? 'latest' : date;
  const body = await fetchJson(
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${version}/v1/currencies/${base}.min.json`
  ) as Record<string, unknown>;
  const rate = (body[base] as Record<string, number> | undefined)?.[to.toLowerCase()];
  if (typeof rate !== 'number') throw new Error(`currency-api has no ${from}→${to} rate`);
  return { rate, rateDate: typeof body.date === 'string' ? body.date : date, source: 'currency-api' };
}

/**
 * Rate to convert `from` into `to` on a date (YYYY-MM-DD). Future dates use the latest rate.
 * Throws if no source has the pair.
 */
export function getExchangeRate(from: string, to: string, date: string): Promise<ExchangeRate> {
  if (from === to) return Promise.resolve({ rate: 1, rateDate: date, source: 'identity' });

  const today = new Date().toISOString().slice(0, 10);
  const day = date.slice(0, 10) >= today ? 'latest' : date.slice(0, 10);
  const key = `${day}|${from}|${to}`;

  let pending = cache.get(key);
  if (!pending) {
    pending = fromFrankfurter(from, to, day).catch(() => fromCurrencyApi(from, to, day));
    pending.catch(() => cache.delete(key)); // Don't cache failures
    cache.set(key, pending);
  }
  return pending;
}

/** Convert an amount, rounded to the cent */
export async function convertAmount(
  amount: number,
  from: string,
  to: string,
  date: string
): Promise<{ amount: number } & ExchangeRate> {
  const rate = await getExchangeRate(from, to, date);
  return { ...rate, amount: Math.round(amount * rate.rate * 100) / 100 };
}

/** For tests */
export function clearExchangeRateCache(): void {
  cache.clear();
}
