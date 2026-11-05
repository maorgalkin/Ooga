import crypto from 'crypto';
import { isBankProvider, makeBankExternalId } from './bank-rules.js';
import type { DuplicateSummary } from './session-manager.js';
import type { TransactionRow } from './supabase-push.js';

/**
 * The part of the Supabase client staging uses. The service role client is passed in, so the
 * logic can be tested without a database.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = { from: (table: string) => any };

/** After this long a session still "importing" has stopped; same as the browser's STALLED_IMPORT_MS */
export const STALLED_IMPORT_MS = 10 * 60 * 1000;

/** The key an imported row is known by: bank rows by account and reference, cards by date, amount and merchant */
export function externalIdFor(tx: TransactionRow, accountNumber: string, provider?: string): string {
  if (provider && isBankProvider(provider)) return makeBankExternalId(provider, accountNumber, tx);
  const raw = `${tx.date}|${tx.chargedAmount}|${tx.description}`;
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
}

const summarize = (tx: TransactionRow, reason: 'exists'): DuplicateSummary => ({
  date: tx.date.slice(0, 10),
  description: tx.description,
  amount: Math.abs(tx.chargedAmount),
  type: tx.chargedAmount < 0 ? 'expense' : 'income',
  reason,
});

/** `.in()` filters go in the URL; keep each request's list short */
async function selectKeys(db: Db, table: string, column: string, householdId: string, keys: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  for (let i = 0; i < keys.length; i += 100) {
    const { data, error } = await db.from(table).select(column).eq('household_id', householdId).in(column, keys.slice(i, i + 100));
    if (error) throw new Error(`Couldn't check for earlier imports: ${error.message}`);
    for (const row of (data ?? []) as Record<string, string>[]) found.add(row[column]);
  }
  return found;
}

export interface StageInput {
  userId: string;
  householdId: string;
  transactions: TransactionRow[];
  accountNumber: string;
  connectionId: string;
  sessionId: string;
  provider?: string;
}

/**
 * Puts an account's fetched rows in the import's holding area (migration 041), to wait for the
 * person's Import. Rows already in the household are reported as such, not staged. Rows a member
 * deleted earlier are staged with their tombstone, so the review offers them unticked. Nothing is
 * written to transactions here: commit_import does that, for the rows the person ticks.
 */
export async function stageTransactions(db: Db, input: StageInput): Promise<{ staged: number; skipped: number; duplicates: DuplicateSummary[] }> {
  const { userId, householdId, transactions, accountNumber, connectionId, sessionId, provider } = input;
  const withKeys = transactions.map(tx => ({ tx, key: externalIdFor(tx, accountNumber, provider) }));
  const keys = [...new Set(withKeys.map(r => r.key))];

  // Household-wide: any member may already have imported this account, or deleted a row of it
  const stored = await selectKeys(db, 'transactions', 'external_id', householdId, keys);
  const tombstoned = await selectKeys(db, 'import_tombstones', 'import_key', householdId, keys);

  const duplicates: DuplicateSummary[] = [];
  const rows: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  for (const { tx, key } of withKeys) {
    if (stored.has(key) || seen.has(key)) {
      duplicates.push(summarize(tx, 'exists'));
      continue;
    }
    seen.add(key);
    rows.push({
      household_id: householdId,
      session_id: sessionId,
      import_key: key,
      tombstone_key: tombstoned.has(key) ? key : null,
      // The transaction it becomes; commit_import keeps only the bank columns and sets the rest
      payload: {
        user_id: userId,
        household_id: householdId,
        date: tx.date.slice(0, 10),
        description: tx.description,
        amount: Math.abs(tx.chargedAmount),
        category: tx.category ?? 'Uncategorized',
        type: tx.chargedAmount < 0 ? 'expense' : 'income',
        source: 'bank_import',
        external_id: key,
        bank_account_number: accountNumber,
        bank_connection_id: connectionId,
        import_session_id: sessionId,
        processed_date: tx.processedDate?.slice(0, 10) ?? null,
        original_amount: tx.originalAmount ?? null,
        original_currency: tx.originalCurrency ?? null,
        installment_number: tx.installments?.number ?? null,
        installment_total: tx.installments?.total ?? null,
        memo: tx.memo ?? null,
        status: tx.status === 'pending' ? 'pending' : 'completed',
      },
    });
  }

  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from('import_staged_rows').upsert(rows.slice(i, i + 500), { onConflict: 'session_id,import_key', ignoreDuplicates: true });
    if (error) throw new Error(`Couldn't keep the fetched rows for review: ${error.message}`);
  }

  return { staged: rows.length, skipped: duplicates.length, duplicates };
}

/**
 * A new fetch of an account replaces the person's older imports of it that still wait for a
 * decision (rows not imported are "not now": this fetch offers them again). A fetch still running
 * in another window is left alone; one stuck for STALLED_IMPORT_MS is replaced. Each is claimed
 * first (marked finished), then emptied, so one Imported at the same moment is never touched.
 */
export async function supersedeOlderImports(db: Db, userId: string, connectionId: string, keepSessionId: string, now = Date.now()): Promise<number> {
  const { data, error } = await db
    .from('bank_import_sessions')
    .select('id, status, started_at')
    .eq('user_id', userId)
    .eq('bank_connection_id', connectionId)
    .is('reviewed_at', null)
    .in('status', ['complete', 'importing'])
    .neq('id', keepSessionId);
  if (error) return 0;

  let replaced = 0;
  for (const s of (data ?? []) as { id: string; status: string; started_at: string }[]) {
    if (s.status === 'importing' && now - Date.parse(s.started_at) < STALLED_IMPORT_MS) continue;
    const { data: claimed } = await db
      .from('bank_import_sessions')
      .update({ status: 'cancelled', reviewed_at: new Date(now).toISOString(), updated_at: new Date(now).toISOString() })
      .eq('id', s.id)
      .is('reviewed_at', null)
      .select('id');
    if (!claimed || claimed.length === 0) continue;
    await db.from('import_staged_rows').delete().eq('session_id', s.id);
    replaced++;
  }
  return replaced;
}
