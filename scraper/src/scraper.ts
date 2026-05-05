import { createScraper, CompanyTypes } from 'israeli-bank-scrapers';
import {
  createSession,
  updateSession,
  getSession,
} from './session-manager.js';
import {
  pushTransactions,
  recordImportSession,
  createImportSessionRecord,
} from './supabase-push.js';

export interface TransactionRow {
  date: string;
  description: string;
  amount: number;
  type: 'normal' | 'installments' | 'standing-order';
  identifier?: string | number;
  memo?: string;
  status: string;
  chargedAmount?: number;
  originalAmount?: number;
  originalCurrency?: string;
}

export async function startScrape(
  sessionId: string,
  userId: string,
  householdId: string,
  startDate: Date,
  endDate: Date
): Promise<void> {
  const dbSessionId = await createImportSessionRecord(
    userId,
    householdId,
    startDate,
    endDate
  );

  // Store dbSessionId on the in-memory session
  updateSession(sessionId, { status: 'logging_in' });

  const otpProvider = (): Promise<string> =>
    new Promise((resolve) => {
      updateSession(sessionId, {
        status: 'awaiting_otp',
        otpResolver: resolve,
      });
    });

  try {
    const scraper = createScraper({
      companyId: CompanyTypes.discount,
      startDate,
      combineInstallments: false,
      showBrowser: false,
      // @ts-expect-error — otpProvider is supported in v6 but types may lag
      otpProvider,
    });

    const credentials = {
      username: process.env.DISCOUNT_BANK_USERNAME!,
      password: process.env.DISCOUNT_BANK_PASSWORD!,
    };

    updateSession(sessionId, { status: 'importing' });

    const result = await scraper.scrape(credentials);

    if (!result.success) {
      const errorMsg = result.errorMessage ?? 'Unknown scraping error';
      updateSession(sessionId, { status: 'error', error: errorMsg });
      await recordImportSession(dbSessionId, 'error', 0, 0, errorMsg);
      return;
    }

    let totalImported = 0;
    let totalSkipped = 0;

    for (const account of result.accounts ?? []) {
      const txns = (account.txns ?? []) as unknown as TransactionRow[];
      const { imported, skipped } = await pushTransactions(
        userId,
        householdId,
        txns,
        account.accountNumber
      );
      totalImported += imported;
      totalSkipped += skipped;
    }

    updateSession(sessionId, {
      status: 'complete',
      result: { imported: totalImported, skipped: totalSkipped },
    });
    await recordImportSession(dbSessionId, 'complete', totalImported, totalSkipped);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unexpected error';
    updateSession(sessionId, { status: 'error', error: msg });
    await recordImportSession(dbSessionId, 'error', 0, 0, msg);
  }
}
