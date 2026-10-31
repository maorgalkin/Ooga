import { supabase } from '../lib/supabase';
import { requestCalOtp as _requestCalOtp, verifyCalOtp, importCalTransactions } from './calDirectService';
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

/** The rows an import fetched that wait for the person's decision, newest first. */
export async function fetchStagedRows(dbSessionId: string): Promise<ReviewTransaction[]> {
  const { data, error } = await supabase
    .from('import_staged_rows')
    .select('id, import_key, tombstone_key, payload')
    .eq('session_id', dbSessionId);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { id: string; import_key: string; tombstone_key: string | null; payload: Partial<StagedPayload> }[];

  // When each deleted-earlier row was deleted, for its tag
  const deletedKeys = rows.map(r => r.tombstone_key).filter((k): k is string => !!k);
  const deletedAt = new Map<string, string>();
  if (deletedKeys.length > 0) {
    const { data: tombstones } = await supabase
      .from('import_tombstones')
      .select('import_key, deleted_at')
      .in('import_key', deletedKeys);
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
  outcome: 'imported' | 'already_imported' | 'missing';
}

/**
 * Imports the ticked rows of an import in one step (commit_import): they move into transactions,
 * rows deleted earlier lose their "deleted" mark, and the import's holding area empties. Rows not
 * passed are "not now": not imported, offered again by the next import.
 */
export async function commitImport(
  dbSessionId: string,
  selected: { id: string; category?: string; category_id?: string | null }[]
): Promise<CommitOutcome[]> {
  const { data, error } = await supabase.rpc('commit_import', { p_session_id: dbSessionId, p_selected: selected });
  if (error) throw new Error(error.message);
  return ((data ?? []) as { staged_id: string; transaction_id: string | null; outcome: CommitOutcome['outcome'] }[])
    .map(r => ({ stagedId: r.staged_id, transactionId: r.transaction_id, outcome: r.outcome }));
}

/** Cancels an import: its holding area empties and nothing reaches the budget. */
export async function discardImport(dbSessionId: string): Promise<void> {
  const { error } = await supabase.from('import_staged_rows').delete().eq('session_id', dbSessionId);
  if (error) throw new Error(error.message);
  const now = new Date().toISOString();
  const { error: sessionError } = await supabase
    .from('bank_import_sessions')
    .update({ status: 'cancelled', reviewed_at: now, updated_at: now })
    .eq('id', dbSessionId);
  if (sessionError) throw new Error(sessionError.message);
}

export interface UnfinishedImport {
  id: string;
  startedAt: string;
  connectionName: string | null;
  rows: number;
}

/**
 * The person's own imports whose rows still wait for a decision ("Finish later"). Empty before
 * migration 041.
 */
export async function listUnfinishedImports(): Promise<UnfinishedImport[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('bank_import_sessions')
    .select('id, started_at, bank_connections(display_name), import_staged_rows(count)')
    .eq('user_id', user.id)
    .eq('status', 'complete')
    .is('reviewed_at', null)
    .order('started_at', { ascending: false });
  if (error) return [];
  type Row = { id: string; started_at: string; bank_connections: { display_name: string } | null; import_staged_rows: { count: number }[] };
  return ((data ?? []) as unknown as Row[])
    .map(r => ({
      id: r.id,
      startedAt: r.started_at,
      connectionName: r.bank_connections?.display_name ?? null,
      rows: r.import_staged_rows?.[0]?.count ?? 0,
    }))
    .filter(r => r.rows > 0);
}
