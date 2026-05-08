import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { decrypt } from './encryption.js';

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface TransactionRow {
  type: 'normal' | 'installments';
  identifier?: string | number;
  date: string;
  processedDate: string;
  originalAmount: number;
  originalCurrency: string;
  chargedAmount: number;
  chargedCurrency?: string;
  description: string;
  memo?: string;
  status: 'completed' | 'pending';
  installments?: { number: number; total: number };
  category?: string;
}

export interface BankConnection {
  id: string;
  provider: string;
  displayName: string;
  credentials: Record<string, string>;
}

function makeExternalId(tx: TransactionRow): string {
  const raw = `${tx.date}|${tx.chargedAmount}|${tx.description}`;
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
}

export async function getUserConnections(userId: string): Promise<BankConnection[]> {
  const { data, error } = await supabase
    .from('bank_connections')
    .select('id, provider, display_name, credentials_encrypted')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Failed to fetch bank connections: ${error.message}`);
  if (!data || data.length === 0) throw new Error('No bank accounts connected. Add a bank account in Settings first.');

  return data.map((row) => ({
    id: row.id,
    provider: row.provider,
    displayName: row.display_name ?? row.provider,
    credentials: JSON.parse(decrypt(row.credentials_encrypted)),
  }));
}

export async function pushTransactions(
  userId: string,
  householdId: string,
  transactions: TransactionRow[],
  accountNumber: string,
  connectionId: string,
  importSessionId?: string
): Promise<{ imported: number; skipped: number }> {
  let imported = 0;
  let skipped = 0;

  for (const tx of transactions) {
    const externalId = makeExternalId(tx);

    const { data: existing } = await supabase
      .from('transactions')
      .select('id')
      .eq('user_id', userId)
      .eq('external_id', externalId)
      .maybeSingle();

    if (existing) {
      skipped++;
      continue;
    }

    const { error } = await supabase.from('transactions').insert({
      user_id: userId,
      household_id: householdId,
      date: tx.date.slice(0, 10),
      description: tx.description,
      amount: Math.abs(tx.chargedAmount),
      category: tx.category ?? 'Uncategorized',
      type: tx.chargedAmount < 0 ? 'expense' : 'income',
      source: 'bank_import',
      external_id: externalId,
      bank_account_number: accountNumber,
      bank_connection_id: connectionId,
      import_session_id: importSessionId ?? null,
      // Extended credit-card fields
      processed_date: tx.processedDate?.slice(0, 10) ?? null,
      original_amount: tx.originalAmount ?? null,
      original_currency: tx.originalCurrency ?? null,
      installment_number: tx.installments?.number ?? null,
      installment_total: tx.installments?.total ?? null,
      memo: tx.memo ?? null,
    });

    if (error) {
      console.error('Failed to insert transaction:', error.message);
    } else {
      imported++;
    }
  }

  return { imported, skipped };
}

export async function updateConnectionLastSync(connectionId: string): Promise<void> {
  await supabase
    .from('bank_connections')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('id', connectionId);
}

export async function recordImportSession(
  sessionDbId: string,
  status: string,
  imported: number,
  skipped: number,
  error?: string
): Promise<void> {
  await supabase
    .from('bank_import_sessions')
    .update({
      status,
      transactions_imported: imported,
      transactions_skipped: skipped,
      error_message: error ?? null,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionDbId);
}

export async function createImportSessionRecord(
  userId: string,
  householdId: string,
  dateRangeStart: Date,
  dateRangeEnd: Date
): Promise<string> {
  const { data, error } = await supabase
    .from('bank_import_sessions')
    .insert({
      user_id: userId,
      household_id: householdId,
      status: 'logging_in',
      date_range_start: dateRangeStart.toISOString().slice(0, 10),
      date_range_end: dateRangeEnd.toISOString().slice(0, 10),
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`Failed to create import session record: ${error?.message}`);
  }
  return data.id;
}

export async function getUserAndHousehold(
  authHeader: string
): Promise<{ userId: string; householdId: string }> {
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    throw new Error('Invalid or expired auth token');
  }

  const { data: member } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .single();

  if (!member) {
    throw new Error('User has no household');
  }

  return { userId: user.id, householdId: member.household_id };
}
