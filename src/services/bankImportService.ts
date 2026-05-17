import { supabase } from '../lib/supabase';
import { requestCalOtp as _requestCalOtp, verifyCalOtp, importCalTransactions } from './calDirectService';
export type { ImportPeriod } from './calDirectService';

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
}

export interface BankConnection {
  id: string;
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
    .select('id, provider, display_name, last_sync_at, is_active, created_at, metadata')
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

  const { data, error } = await supabase
    .from('bank_connections')
    .insert({
      user_id: user.id,
      provider,
      display_name: displayName,
      metadata,
      is_active: true,
    })
    .select('id, provider, display_name, last_sync_at, is_active, created_at, metadata')
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
): Promise<{ dbSessionId: string; imported: number; skipped: number }> {
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
