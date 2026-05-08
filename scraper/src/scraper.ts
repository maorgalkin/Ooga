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
        const scraper = createScraper({
          companyId: conn.provider as CompanyTypes,
          startDate,
          combineInstallments: false,
          showBrowser: false,
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });

        console.log(`→ Scraping ${conn.displayName} (${conn.provider})`);
        const result = await scraper.scrape(conn.credentials as never);

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
