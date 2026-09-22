import { describe, it, expect } from 'vitest';
import {
  toMonthKey,
  parseMonthKey,
  getDefaultMonthIndex,
  getMonthsWithData,
} from '../../src/utils/dateHelpers';

describe('toMonthKey / parseMonthKey', () => {
  it('should round-trip a month', () => {
    const date = new Date(2026, 8, 22); // September 22, 2026
    expect(toMonthKey(date)).toBe('2026-09');
    expect(parseMonthKey('2026-09')).toEqual(new Date(2026, 8, 1));
  });

  it('should reject malformed keys', () => {
    expect(parseMonthKey(null)).toBeNull();
    expect(parseMonthKey('')).toBeNull();
    expect(parseMonthKey('2026-9')).toBeNull();
    expect(parseMonthKey('2026-13')).toBeNull();
    expect(parseMonthKey('2026-00')).toBeNull();
    expect(parseMonthKey('garbage')).toBeNull();
  });
});

describe('getDefaultMonthIndex', () => {
  const now = new Date(2026, 8, 22); // September 2026

  it('should skip future months (e.g. upcoming installments) and pick the current month', () => {
    const months = getMonthsWithData([
      { date: '2027-06-01' }, // last installment
      { date: '2026-12-01' },
      { date: '2026-09-15' }, // current month
      { date: '2026-08-03' },
    ]);
    const index = getDefaultMonthIndex(months, now);
    expect(months[index].start).toEqual(new Date(2026, 8, 1));
  });

  it('should fall back to the closest past month when the current month has no data', () => {
    const months = getMonthsWithData([
      { date: '2026-11-01' },
      { date: '2026-07-10' },
      { date: '2026-05-10' },
    ]);
    const index = getDefaultMonthIndex(months, now);
    expect(months[index].start).toEqual(new Date(2026, 6, 1));
  });

  it('should fall back to the oldest month when every month is in the future', () => {
    const months = getMonthsWithData([{ date: '2027-01-01' }, { date: '2026-10-01' }]);
    expect(getDefaultMonthIndex(months, now)).toBe(1);
  });

  it('should return 0 for an empty list', () => {
    expect(getDefaultMonthIndex([], now)).toBe(0);
  });
});
