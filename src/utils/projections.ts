/**
 * Future-month projections: charges that are already committed but not yet in the database.
 *
 * Phase 1 covers installments only:
 * - In-app installment plans already have a row for every month (nothing to project).
 * - Bank-imported (Cal) installments only exist up to the latest statement, so the
 *   remaining payments of each series are projected here.
 */

import type { Transaction } from '../types';
import type { BudgetAdjustment, PersonalBudget } from '../types/budget';
import { addMonthsToIsoDate, getMonthStart } from './dateHelpers';

const monthIndexOf = (isoDate: string) => {
  const [y, m] = isoDate.slice(0, 10).split('-').map(Number);
  return y * 12 + (m - 1);
};

const isBankInstallment = (t: Transaction) =>
  !t.installment_group_id && !t.projected &&
  !!t.installment_number && !!t.installment_total && t.installment_total > 1;

/**
 * Remaining payments of bank-imported installment series, in months after the current one.
 *
 * Each series is continued from its latest imported charge. Cal puts rounding leftovers on the
 * first payment and payments 2..N are equal, so the latest charge's amount is used for the rest
 * (exact once payment 2 is imported; at most a few agorot off while only payment 1 is known).
 * Charges that would fall in the current month are left to the next import.
 */
export function getProjectedBankInstallments(transactions: Transaction[], now: Date = new Date()): Transaction[] {
  const currentMonthIndex = now.getFullYear() * 12 + now.getMonth();

  // Series key: merchant + number of payments + purchase month (charge n is dated purchase + n−1 months)
  const latestBySeries = new Map<string, Transaction>();
  for (const t of transactions) {
    if (!isBankInstallment(t)) continue;
    const purchaseMonthIndex = monthIndexOf(t.date) - (t.installment_number! - 1);
    const key = `${t.type}|${t.description}|${t.installment_total}|${purchaseMonthIndex}`;
    const latest = latestBySeries.get(key);
    if (!latest || t.installment_number! > latest.installment_number!) latestBySeries.set(key, t);
  }

  const projected: Transaction[] = [];
  for (const [key, latest] of latestBySeries) {
    const total = latest.installment_total!;
    for (let n = latest.installment_number! + 1; n <= total; n++) {
      const date = addMonthsToIsoDate(latest.date, n - latest.installment_number!);
      if (monthIndexOf(date) <= currentMonthIndex) continue;
      projected.push({
        ...latest,
        id: `projected:${key}:${n}`,
        date,
        installment_number: n,
        projected: true,
      });
    }
  }
  return projected;
}

/**
 * The last month with a committed charge (future-dated rows or projected ones),
 * or the current month if nothing is committed beyond it.
 */
export function getLastCommittedMonth(transactions: Transaction[], now: Date = new Date()): Date {
  const currentMonthIndex = now.getFullYear() * 12 + now.getMonth();
  const lastIndex = transactions.reduce((max, t) => Math.max(max, monthIndexOf(t.date)), currentMonthIndex);
  return getMonthStart(new Date(Math.floor(lastIndex / 12), lastIndex % 12, 1));
}

/**
 * Category limits for a future month, built in memory: the active budget with every
 * scheduled (not yet applied) adjustment effective on or before that month applied in order.
 * Applied adjustments become part of the active budget, so they carry into later months too.
 */
export function buildProjectedBudgetLimits(
  personalBudget: PersonalBudget | null | undefined,
  pendingAdjustments: BudgetAdjustment[],
  month: Date
): Record<string, number> {
  const limits: Record<string, number> = {};
  for (const [name, config] of Object.entries(personalBudget?.categories ?? {})) {
    if (config.isActive !== false) limits[name] = config.monthlyLimit;
  }

  const monthIndex = month.getFullYear() * 12 + month.getMonth();
  [...pendingAdjustments]
    .filter(a => a.effective_year * 12 + (a.effective_month - 1) <= monthIndex)
    .sort((a, b) =>
      (a.effective_year * 12 + a.effective_month) - (b.effective_year * 12 + b.effective_month) ||
      a.created_at.localeCompare(b.created_at))
    .forEach(a => { limits[a.category_name] = a.new_limit; });

  return limits;
}
