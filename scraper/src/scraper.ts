import { createScraper, CompanyTypes } from 'israeli-bank-scrapers';
import type { Transaction } from 'israeli-bank-scrapers/lib/transactions.js';
import {
  updateSession,
} from './session-manager.js';
import {
  type TransactionRow,
  pushTransactions,
  recordImportSession,
  createImportSessionRecord,
  getUserConnections,
  updateConnectionLastSync,
} from './supabase-push.js';
import { VisaCalFastScraper, type VisaCalFastCredentials } from './scrapers/visa-cal-fast.js';

function mapTransaction(tx: Transaction): TransactionRow {
  return {
    type: tx.type as 'normal' | 'installments',
    identifier: tx.identifier,
    date: tx.date,
    processedDate: tx.processedDate,
    originalAmount: tx.originalAmount,
    originalCurrency: tx.originalCurrency,
    chargedAmount: tx.chargedAmount,
    chargedCurrency: tx.chargedCurrency,
    description: tx.description,
    memo: tx.memo,
    status: tx.status as 'completed' | 'pending',
    installments: tx.installments
      ? { number: tx.installments.number, total: tx.installments.total }
      : undefined,
    category: tx.category,
  };
}

// Optional SOCKS5/HTTP proxy for geo-restricted scrapers (e.g., Israeli banks from non-IL servers)
// Set PUPPETEER_PROXY=socks5://HOST:PORT in .env.scraper
const proxyArg = process.env.PUPPETEER_PROXY
  ? [`--proxy-server=${process.env.PUPPETEER_PROXY}`]
  : [];
const BASE_ARGS = ['--no-sandbox', '--disable-setuid-sandbox', ...proxyArg];

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

  updateSession(sessionId, { status: 'logging_in', dbSessionId });

  try {
    const connections = await getUserConnections(userId);

    console.log(`Starting scrape for ${connections.length} connection(s)`);
    updateSession(sessionId, { status: 'importing' });

    // Run all scrapers in parallel
    const results = await Promise.allSettled(
      connections.map(async (conn) => {
        console.log(`→ Scraping ${conn.displayName} (${conn.provider})`);

        let result;

        if (conn.provider === 'visaCalFast') {
          // Use the custom fast-access scraper with OTP support
          const requestOtp = (): Promise<string> =>
            new Promise((resolve) => {
              updateSession(sessionId, { status: 'awaiting_otp', otpResolver: resolve });
            });

          const scraper = new VisaCalFastScraper(
            {
              companyId: 'visaCal' as CompanyTypes,
              startDate,
              combineInstallments: false,
              showBrowser: false,
              args: BASE_ARGS,
            },
            requestOtp,
          );

          result = await scraper.scrape(conn.credentials as never);
          // Resume from awaiting_otp back to importing once scraper finishes
          updateSession(sessionId, { status: 'importing', otpResolver: undefined });
        } else {
          const scraper = createScraper({
            companyId: conn.provider as CompanyTypes,
            startDate,
            combineInstallments: false,
            showBrowser: false,
            args: BASE_ARGS,
          });

          result = await scraper.scrape(conn.credentials as never);
        }

        if (!result.success) {
          throw new Error(`${conn.displayName}: ${result.errorMessage ?? 'Scrape failed'}`);
        }

        let imported = 0;
        let skipped = 0;
        for (const account of result.accounts ?? []) {
          const txns = account.txns.map(mapTransaction);
          const stats = await pushTransactions(
            userId,
            householdId,
            txns,
            account.accountNumber,
            conn.id,
            dbSessionId
          );
          imported += stats.imported;
          skipped += stats.skipped;
        }

        await updateConnectionLastSync(conn.id);
        console.log(`✓ ${conn.displayName}: ${imported} imported, ${skipped} skipped`);
        return { connectionId: conn.id, imported, skipped };
      })
    );

    let totalImported = 0;
    let totalSkipped = 0;
    const errors: string[] = [];

    for (const r of results) {
      if (r.status === 'fulfilled') {
        totalImported += r.value.imported;
        totalSkipped += r.value.skipped;
      } else {
        errors.push(r.reason instanceof Error ? r.reason.message : String(r.reason));
        console.error('Scrape error:', r.reason);
      }
    }

    if (errors.length === results.length) {
      // All scrapers failed
      const errorMsg = errors.join('; ');
      updateSession(sessionId, { status: 'error', error: errorMsg });
      await recordImportSession(dbSessionId, 'error', 0, 0, errorMsg);
      return;
    }

    const partialError = errors.length > 0 ? `Partial errors: ${errors.join('; ')}` : undefined;
    updateSession(sessionId, {
      status: 'complete',
      result: { imported: totalImported, skipped: totalSkipped },
      error: partialError,
    });
    await recordImportSession(dbSessionId, 'complete', totalImported, totalSkipped, partialError);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unexpected error';
    updateSession(sessionId, { status: 'error', error: msg });
    await recordImportSession(dbSessionId, 'error', 0, 0, msg);
  }
}
