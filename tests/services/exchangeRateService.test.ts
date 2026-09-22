import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  toCurrencyCode,
  getExchangeRate,
  convertAmount,
  clearExchangeRateCache,
} from '../../src/services/exchangeRateService';

const jsonResponse = (body: unknown, ok = true) =>
  Promise.resolve({ ok, status: ok ? 200 : 404, json: () => Promise.resolve(body) } as Response);

describe('toCurrencyCode', () => {
  it('maps symbols, numeric and ISO codes', () => {
    expect(toCurrencyCode('$')).toBe('USD');
    expect(toCurrencyCode('€')).toBe('EUR');
    expect(toCurrencyCode('₪')).toBe('ILS');
    expect(toCurrencyCode('376')).toBe('ILS');
    expect(toCurrencyCode('usd')).toBe('USD');
    expect(toCurrencyCode(' GBP ')).toBe('GBP');
  });

  it('returns null for unknown values', () => {
    expect(toCurrencyCode(null)).toBeNull();
    expect(toCurrencyCode('')).toBeNull();
    expect(toCurrencyCode('dollars')).toBeNull();
  });
});

describe('getExchangeRate', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    clearExchangeRateCache();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('uses ECB rates from Frankfurter for the given date', async () => {
    fetchMock.mockReturnValueOnce(jsonResponse({ date: '2026-09-18', rates: { ILS: 3.0377 } }));
    const rate = await getExchangeRate('USD', 'ILS', '2026-09-20');
    expect(fetchMock).toHaveBeenCalledWith('https://api.frankfurter.dev/v1/2026-09-20?base=USD&symbols=ILS');
    expect(rate).toEqual({ rate: 3.0377, rateDate: '2026-09-18', source: 'ECB' });
  });

  it('falls back to currency-api when Frankfurter lacks the pair', async () => {
    fetchMock
      .mockReturnValueOnce(jsonResponse({ message: 'not found' }, false))
      .mockReturnValueOnce(jsonResponse({ date: '2026-09-20', vnd: { ils: 0.000123 } }));
    const rate = await getExchangeRate('VND', 'ILS', '2026-09-20');
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@2026-09-20/v1/currencies/vnd.min.json'
    );
    expect(rate).toEqual({ rate: 0.000123, rateDate: '2026-09-20', source: 'currency-api' });
  });

  it('uses the latest rate for future dates and caches repeated lookups', async () => {
    fetchMock.mockReturnValue(jsonResponse({ date: '2026-09-22', rates: { ILS: 3.0178 } }));
    await getExchangeRate('USD', 'ILS', '2999-01-01');
    await getExchangeRate('USD', 'ILS', '2999-01-01');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('https://api.frankfurter.dev/v1/latest?base=USD&symbols=ILS');
  });

  it('needs no lookup for the same currency', async () => {
    expect(await getExchangeRate('ILS', 'ILS', '2026-09-20')).toMatchObject({ rate: 1, source: 'identity' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects when no source has the pair, without caching the failure', async () => {
    fetchMock.mockReturnValue(jsonResponse({}, false));
    await expect(getExchangeRate('XXX', 'ILS', '2026-09-20')).rejects.toThrow();
    fetchMock.mockReturnValueOnce(jsonResponse({ date: '2026-09-20', rates: { ILS: 1.5 } }));
    await expect(getExchangeRate('XXX', 'ILS', '2026-09-20')).resolves.toMatchObject({ rate: 1.5 });
  });

  it('converts and rounds to the cent', async () => {
    fetchMock.mockReturnValueOnce(jsonResponse({ date: '2026-09-18', rates: { ILS: 3.0377 } }));
    expect((await convertAmount(5.99, 'USD', 'ILS', '2026-09-20')).amount).toBe(18.2);
  });
});
