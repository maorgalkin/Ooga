import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import type { Transaction } from '../../src/types';
import { filterTransactionsByDateRange, getDateRange } from '../../src/utils/dateRangeFilters';
import { parseTransactionDate } from '../../src/utils/dateHelpers';

// Israel is ahead of UTC, where a bare "YYYY-MM-DD" lands later in the day than local midnight.
// Pinned so the tests catch that on CI machines that run in UTC.
const originalTz = process.env.TZ;
beforeAll(() => {
  process.env.TZ = 'Asia/Jerusalem';
});
afterAll(() => {
  process.env.TZ = originalTz;
});
afterEach(() => {
  vi.useRealTimers();
});

const tx = (date: string): Transaction =>
  ({ id: date, date, description: '', amount: 10, category: 'Food', type: 'expense' }) as Transaction;

describe('date ranges', () => {
  it("reads a transaction's day as local midnight", () => {
    const d = parseTransactionDate('2026-10-31');
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 9, 31, 0]);
  });

  it("keeps today's transactions in the month to date just after midnight", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 31, 0, 30));
    expect(filterTransactionsByDateRange([tx('2026-10-31'), tx('2026-10-01')], 'mtd')).toHaveLength(2);
  });

  it('includes the last day of last quarter and of the last 12 months', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 15, 12));
    expect(filterTransactionsByDateRange([tx('2026-09-30'), tx('2026-07-01')], 'lastQuarter')).toHaveLength(2);
    expect(filterTransactionsByDateRange([tx('2026-09-30'), tx('2025-09-01'), tx('2026-10-01')], 'lastYear')).toHaveLength(2);
  });

  it('ends ranges to date at the end of today', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 31, 0, 30));
    const { endDate } = getDateRange('ytd');
    expect([endDate.getDate(), endDate.getHours(), endDate.getMinutes()]).toEqual([31, 23, 59]);
  });
});
