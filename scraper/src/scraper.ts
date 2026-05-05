import { createScraper, CompanyTypes } from 'israeli-bank-scrapers';
import {
  updateSession,
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

  try {
    // Discount Bank uses Puppeteer; --no-sandbox is required inside Docker
    const scraper = createScraper({
      companyId: CompanyTypes.discount,
      startDate,
      combineInstallments: false,
      showBrowser: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    // Discount Bank login: id = national ID, password = password, num = access code (קוד גישה)
    const credentials = {
      id: process.env.DISCOUNT_BANK_USERNAME!,
      password: process.env.DISCOUNT_BANK_PASSWORD!,
      num: process.env.DISCOUNT_BANK_NUM!,
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
