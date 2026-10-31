import { supabase } from '../lib/supabase';
import {
  requestCalOtp as _requestCalOtp,
  verifyCalOtp,
  importCalTransactions,
  loadStoredForPlanning,
  applyBilledUpdates,
  planImport,
  discardStagedSession,
  STALLED_IMPORT_MS,
  type NormalizedTx,
} from './calDirectService';
import { PersonalBudgetService } from './personalBudgetService';
import { toCurrencyCode } from './exchangeRateService';
export type { ImportPeriod } from './calDirectService';
import type { CalImportResult } from './calDirectService';
export type { DuplicateSummary, CalImportResult, ImportMode } from './calDirectService';

export type ImportStatus =
  | 'logging_in'
  | 'awaiting_otp'
  | 'importing'
  | 'complete'
  | 'error';

export interface ReviewTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  category_id: string | null;
  original_amount: number | null;
  original_currency: string | null;
  installment_number: number | null;
  installment_total: number | null;
  memo: string | null;
  bank_connection_id: string | null;
  bank_card_last4: string | null;
  /** Holding-area rows only: a household member deleted this bank row before, on this date */
  deletedEarlier?: { at: string | null };
}

export interface BankConnection {
  id: string;
  user_id: string; // Who added it — only they can remove it; everyone in the household can import it
  provider: string;
  display_name: string;
  last_sync_at: string | null;
  is_active: boolean;
  created_at: string;
  metadata?: Record<string, unknown> | null;
}

// Re-export for use in BankImportModal
export { requestCalOtp as requestCalOtpDirect, verifyCalOtp } from './calDirectService';
export type { CalCard } from './calDirectService';

// ─── Connection management (direct Supabase — no server needed) ───────────────

export async function listConnections(): Promise<BankConnection[]> {
  const { data, error } = await supabase
    .from('bank_connections')
    .select('id, user_id, provider, display_name, last_sync_at, is_active, created_at, metadata')
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as BankConnection[];
}

export async function addConnection(
  provider: string,
  metadata: Record<string, unknown>,
  displayName: string
): Promise<BankConnection> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Connections are shared with the household
  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from('bank_connections')
    .insert({
      user_id: user.id,
      household_id: membership?.household_id ?? null,
      provider,
      display_name: displayName,
      metadata,
      is_active: true,
    })
    .select('id, user_id, provider, display_name, last_sync_at, is_active, created_at, metadata')
    .single();

  if (error) throw new Error(error.message);
  return data as BankConnection;
}

export async function deleteConnection(connectionId: string): Promise<void> {
  const { error } = await supabase
    .from('bank_connections')
    .delete()
    .eq('id', connectionId);

  if (error) throw new Error(error.message);
}

// ─── Cal import flow ──────────────────────────────────────────────────────────

/**
 * Request OTP for a Cal connection.
 * Reads nationalId and last4Digits from the connection's metadata.
 * Returns calSessionToken to pass to importCalDirect().
 */
export async function requestCalOtpForConnection(connection: BankConnection): Promise<string> {
  const nationalId = (connection.metadata?.id as string | undefined) ?? '';
  const last4Digits = (connection.metadata?.last4Digits as string | undefined) ?? '';
  if (!nationalId) throw new Error('Connection is missing national ID in metadata. Please reconnect your account.');
  return _requestCalOtp(nationalId, last4Digits);
}

/**
 * Full import: verify OTP + fetch transactions + push to Supabase.
 */
export async function importCalDirect(
  connection: BankConnection,
  calSessionToken: string,
  otpCode: string,
  period: import('./calDirectService').ImportPeriod,
  onProgress?: (msg: string) => void
): Promise<CalImportResult> {
  const nationalId = (connection.metadata?.id as string | undefined) ?? '';
  if (!nationalId) throw new Error('Connection is missing national ID in metadata. Please reconnect your account.');

  const otpToken = await verifyCalOtp(nationalId, calSessionToken, otpCode);
  return importCalTransactions(connection.id, otpToken, period, onProgress);
}

// ─── Import review (direct Supabase queries) ──────────────────────────────────

export async function fetchImportedTransactions(dbSessionId: string): Promise<ReviewTransaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('id, date, description, amount, type, category, category_id, original_amount, original_currency, installment_number, installment_total, memo, bank_connection_id, bank_card_last4')
    .eq('import_session_id', dbSessionId)
    .order('date', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as ReviewTransaction[];
}

export async function updateTransactionCategory(
  id: string,
  categoryId: string | null,
  categoryName: string
): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .update({ category: categoryName, category_id: categoryId })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function deleteTransactions(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from('transactions')
    .delete()
    .in('id', ids);

  if (error) throw new Error(error.message);
}

// ─── The holding area (migration 041) ─────────────────────────────────────────

type StagedPayload = Omit<ReviewTransaction, 'id' | 'deletedEarlier'>;
interface StagedRow {
  id: string;
  household_id: string;
  import_key: string;
  tombstone_key: string | null;
  payload: Partial<StagedPayload> & Record<string, unknown>;
}

const PAGE = 1000;

/** Every row waiting in an import's holding area, page by page. */
async function loadStaged(dbSessionId: string): Promise<StagedRow[]> {
  const rows: StagedRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('import_staged_rows')
      .select('id, household_id, import_key, tombstone_key, payload')
      .eq('session_id', dbSessionId)
      .order('id')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as StagedRow[]));
    if ((data ?? []).length < PAGE) return rows;
  }
}

/** The rows an import fetched that wait for the person's decision, newest first. */
export async function fetchStagedRows(dbSessionId: string): Promise<ReviewTransaction[]> {
  const rows = await loadStaged(dbSessionId);

  // When each deleted-earlier row was deleted, for its tag
  const deletedKeys = [...new Set(rows.map(r => r.tombstone_key).filter((k): k is string => !!k))];
  const deletedAt = new Map<string, string>();
  const householdId = rows[0]?.household_id;
  for (let i = 0; householdId && i < deletedKeys.length; i += 100) {
    const { data: tombstones } = await supabase
      .from('import_tombstones')
      .select('import_key, deleted_at')
      .eq('household_id', householdId)
      .in('import_key', deletedKeys.slice(i, i + 100));
    for (const t of (tombstones ?? []) as { import_key: string; deleted_at: string }[]) deletedAt.set(t.import_key, t.deleted_at);
  }

  return rows
    .map((r): ReviewTransaction => ({
      id: r.id,
      date: r.payload.date ?? '',
      description: r.payload.description ?? '',
      amount: Number(r.payload.amount ?? 0),
      type: r.payload.type === 'income' ? 'income' : 'expense',
      category: r.payload.category ?? 'Uncategorized',
      category_id: r.payload.category_id ?? null,
      original_amount: r.payload.original_amount ?? null,
      original_currency: r.payload.original_currency ?? null,
      installment_number: r.payload.installment_number ?? null,
      installment_total: r.payload.installment_total ?? null,
      memo: r.payload.memo ?? null,
      bank_connection_id: r.payload.bank_connection_id ?? null,
      bank_card_last4: r.payload.bank_card_last4 ?? null,
      ...(r.tombstone_key ? { deletedEarlier: { at: deletedAt.get(r.tombstone_key) ?? null } } : {}),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export interface CommitOutcome {
  stagedId: string;
  transactionId: string | null;
  /**
   * imported · imported_joined (and joined to the "Paid with" entry named; transactionId is the
   * entry) · imported_not_joined (the join failed, so it came in on its own) · updated (it was the
   * billed version of a charge already stored, which now carries the billed amount) ·
   * already_imported (stored already, by another member or another import) · deleted_meanwhile
   * (a member deleted it after it was fetched) · missing (no longer waiting).
   * Before migration 042 the database only answers imported / already_imported / missing, and
   * ignores entry_id.
   */
  outcome: 'imported' | 'imported_joined' | 'imported_not_joined' | 'updated' | 'already_imported' | 'deleted_meanwhile' | 'missing';
}

/** A ticked row, its category choice, and the manual "Paid with" entry it joins, if any */
type Selection = { id: string; category?: string; category_id?: string | null; entry_id?: string };

/** Imports the given rows in one step (commit_import) and finishes the import. */
export async function commitImport(dbSessionId: string, selected: Selection[]): Promise<CommitOutcome[]> {
  const { data, error } = await supabase.rpc('commit_import', { p_session_id: dbSessionId, p_selected: selected });
  if (error) throw new Error(error.message);
  return ((data ?? []) as { staged_id: string; transaction_id: string | null; outcome: CommitOutcome['outcome'] }[])
    .map(r => ({ stagedId: r.staged_id, transactionId: r.transaction_id, outcome: r.outcome }));
}

/**
 * Import: plans the ticked rows again against what's stored now, then imports what's still new.
 * Rows can wait in the holding area while another import (a member's, or a later fetch) stores
 * the same charge, possibly as its pending or billed version under another key; the database
 * alone can't tell those apart. So, just before Import:
 * - a billed row whose pending version is stored updates that row instead (outcome "updated");
 * - a row stored meanwhile is reported "already_imported" and not imported again;
 * - the rest go to commit_import. A row deleted earlier that the person ticked is brought back.
 * Unticked rows are "not now"; the import's holding area empties either way.
 */
export async function commitImportWithReplan(dbSessionId: string, selected: Selection[]): Promise<CommitOutcome[]> {
  const ticked = new Set(selected.map(s => s.id));
  const staged = (await loadStaged(dbSessionId)).filter(r => ticked.has(r.id));
  const outcomes: CommitOutcome[] = [];
  let toCommit = selected;

  // Rows from browser imports carry what's needed to match them (dedupe_hash, _linkKey); others go straight through
  const plannable = staged.filter(r => typeof r.payload.dedupe_hash === 'string' && typeof r.payload._linkKey === 'string');
  if (plannable.length > 0) {
    const asTx = new Map(plannable.map(r => [r.id, { ...r.payload, _legacyHash: r.payload._legacyHash ?? '' } as unknown as NormalizedTx]));
    const stagedIdOf = new Map([...asTx].map(([id, tx]) => [tx, id]));
    const householdId = plannable[0].household_id;
    const connectionId = String(plannable[0].payload.bank_connection_id ?? '');
    const budget = await PersonalBudgetService.getActiveBudget().catch(() => null);
    const budgetCurrency = toCurrencyCode(budget?.global_settings?.currency) ?? 'ILS';

    const { existing, pendingRows, billedRows } = await loadStoredForPlanning([...asTx.values()], householdId, connectionId);
    // The person ticked them, so rows deleted earlier aren't held back by their tombstones
    // A waiting pending row never overwrites a stored pending one: that came from a later fetch
    const { toInsert, toUpdate, duplicates } = planImport([...asTx.values()], existing, budgetCurrency, { pendingRows, billedRows, refreshPending: false });

    await applyBilledUpdates(toUpdate, [...existing, ...pendingRows]);
    const settled = new Set<string>();
    for (const { tx } of toUpdate) {
      const stagedId = stagedIdOf.get(tx)!;
      settled.add(stagedId);
      outcomes.push({ stagedId, transactionId: null, outcome: 'updated' });
    }
    for (const tx of duplicates) {
      const stagedId = stagedIdOf.get(tx)!;
      settled.add(stagedId);
      outcomes.push({ stagedId, transactionId: null, outcome: 'already_imported' });
    }
    // Only what the plan still calls new is imported. Anything else it set aside (the pending
    // version of a charge whose billed version is ticked too, a repeat) is already covered.
    const stillNew = new Set(toInsert.map(tx => stagedIdOf.get(tx)!));
    for (const id of asTx.keys()) {
      if (!stillNew.has(id) && !settled.has(id)) outcomes.push({ stagedId: id, transactionId: null, outcome: 'already_imported' });
    }
    toCommit = selected.filter(s => !asTx.has(s.id) || stillNew.has(s.id));
  }

  // Always called: it finishes the import and empties its holding area, even with nothing left to add
  return [...outcomes, ...(await commitImport(dbSessionId, toCommit))];
}

/** Cancels an import: its holding area empties and nothing reaches the budget. */
export const discardImport = discardStagedSession;

/** Makes an import that stopped while fetching reviewable: its rows are complete, it just wasn't marked so. */
export async function reopenImport(dbSessionId: string): Promise<void> {
  const { error } = await supabase
    .from('bank_import_sessions')
    .update({ status: 'complete', updated_at: new Date().toISOString() })
    .eq('id', dbSessionId)
    .eq('status', 'importing')
    .is('reviewed_at', null);
  if (error) throw new Error(error.message);
}

export interface UnfinishedImport {
  id: string;
  startedAt: string;
  connectionName: string | null;
  rows: number;
  /** It stopped while fetching (its rows are there, its status wasn't updated): reopen before reviewing */
  stalled: boolean;
}


/**
 * The person's own imports whose rows still wait for a decision: postponed with "Finish later",
 * or stopped while fetching. Empty before migration 041.
 */
export async function listUnfinishedImports(): Promise<UnfinishedImport[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('bank_import_sessions')
    .select('id, status, started_at, bank_connections(display_name), import_staged_rows(count)')
    .eq('user_id', user.id)
    .in('status', ['complete', 'importing'])
    .is('reviewed_at', null)
    .order('started_at', { ascending: false });
  if (error) return [];
  type Row = { id: string; status: string; started_at: string; bank_connections: { display_name: string } | null; import_staged_rows: { count: number }[] };
  const stalledBefore = Date.now() - STALLED_IMPORT_MS;
  return ((data ?? []) as unknown as Row[])
    .filter(r => r.status === 'complete' || Date.parse(r.started_at) < stalledBefore)
    .map(r => ({
      id: r.id,
      startedAt: r.started_at,
      connectionName: r.bank_connections?.display_name ?? null,
      rows: r.import_staged_rows?.[0]?.count ?? 0,
      stalled: r.status === 'importing',
    }))
    .filter(r => r.rows > 0);
}
