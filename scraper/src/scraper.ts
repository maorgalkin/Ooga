import { createScraper, CompanyTypes } from 'israeli-bank-scrapers';
import type { Transaction } from 'israeli-bank-scrapers/lib/transactions.js';
import {
  updateSession,
  unlockImports,
} from './session-manager.js';
import {
  type TransactionRow,
  supabase,
  recordImportSession,
  createImportSessionRecord,
  getHouseholdConnections,
  updateConnectionLastSync,
} from './supabase-push.js';
import { stageTransactions, supersedeOlderImports } from './staging.js';
import { isBankProvider, isCardBillPayment } from './bank-rules.js';
import type { DuplicateSummary, SkippedCardBill } from './session-manager.js';

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

/** Marks the import complete; retried once, since the review can't open until it is */
async function finishImport(dbSessionId: string, imported: number, skipped: number, note?: string): Promise<void> {
  try {
    await recordImportSession(dbSessionId, 'complete', imported, skipped, note);
  } catch {
    await recordImportSession(dbSessionId, 'complete', imported, skipped, note);
  }
}

/**
 * Fetches the account(s) and puts their new rows in the import's holding area, where they wait
 * for the person's Import in the app. `lockKeys` (claimed by the caller with tryLockImports) are
 * released when this ends, however it ends.
 */
export async function startScrape(
  sessionId: string,
  userId: string,
  householdId: string,
  startDate: Date,
  endDate: Date,
  connectionId: string | undefined, // Import just this connection (default: all with stored credentials)
  lockKeys: string[]
): Promise<void> {
  let dbSessionId: string;
  try {
    dbSessionId = await createImportSessionRecord(userId, householdId, startDate, endDate, connectionId);
  } catch (err) {
    unlockImports(lockKeys);
    throw err;
  }

  updateSession(sessionId, { status: 'logging_in', dbSessionId });

  try {
    const connections = await getHouseholdConnections(householdId, connectionId);
    const skippedCardBills: SkippedCardBill[] = [];
    const duplicates: DuplicateSummary[] = [];
    const endDay = endDate.toISOString().slice(0, 10);

    console.log(`Starting scrape for ${connections.length} connection(s)`);
    updateSession(sessionId, { status: 'importing' });

    // Run all scrapers in parallel
    const results = await Promise.allSettled(
      connections.map(async (conn) => {
        console.log(`→ Scraping ${conn.displayName} (${conn.provider})`);

        // Visa Cal with an SMS code is imported in the browser and never reaches here
        // (getHouseholdConnections leaves it out), so there's no code to wait for
        const scraper = createScraper({
          companyId: conn.provider as CompanyTypes,
          startDate,
          combineInstallments: false,
          showBrowser: false,
          args: BASE_ARGS,
        });
        const result = await scraper.scrape(conn.credentials as never);

        if (!result.success) {
          throw new Error(`${conn.displayName}: ${result.errorMessage ?? 'Scrape failed'}`);
        }

        let imported = 0;
        let skipped = 0;
        for (const account of result.accounts ?? []) {
          let txns: TransactionRow[] = account.txns.map(mapTransaction).filter((tx: TransactionRow) => tx.date.slice(0, 10) <= endDay);

          if (isBankProvider(conn.provider)) {
            // Checking accounts: completed only (future/scheduled debits may still change), and
            // no credit-card bills — the card's purchases are imported individually.
            txns = txns.filter((tx: TransactionRow) => {
              if (tx.status === 'pending') return false;
              if (isCardBillPayment(tx.description)) {
                skippedCardBills.push({ date: tx.date.slice(0, 10), description: tx.description, amount: Math.abs(tx.chargedAmount) });
                return false;
              }
              return true;
            });
          }

          // A failure here throws, so this account counts as failed and isn't marked synced
          const stats = await stageTransactions(supabase, {
            userId,
            householdId,
            transactions: txns,
            accountNumber: account.accountNumber,
            connectionId: conn.id,
            sessionId: dbSessionId,
            provider: conn.provider,
          });
          imported += stats.staged;
          skipped += stats.skipped;
          duplicates.push(...stats.duplicates);
        }

        console.log(`✓ ${conn.displayName}: ${imported} waiting for review, ${skipped} already in the account`);
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
      await recordImportSession(dbSessionId, 'error', 0, 0, errorMsg).catch(() => {});
      return;
    }

    const partialError = errors.length > 0 ? `Partial errors: ${errors.join('; ')}` : undefined;
    await finishImport(dbSessionId, totalImported, totalSkipped, partialError);
    // Synced only once its rows are kept and the import recorded, so a failed one is fetched again
    for (const r of results) {
      if (r.status === 'fulfilled') await updateConnectionLastSync(r.value.connectionId).catch(() => {});
    }
    // This fetch replaces the person's older imports of the account still waiting for a decision
    if (connectionId) await supersedeOlderImports(supabase, userId, connectionId, dbSessionId).catch(() => 0);
    updateSession(sessionId, {
      status: 'complete',
      result: { imported: totalImported, skipped: totalSkipped, skippedCardBills, duplicates, mode: 'staged' },
      error: partialError,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unexpected error';
    updateSession(sessionId, { status: 'error', error: msg });
    await recordImportSession(dbSessionId, 'error', 0, 0, msg).catch(() => {});
  } finally {
    unlockImports(lockKeys);
  }
}
