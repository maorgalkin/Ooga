import { createClient } from '@supabase/supabase-js';
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

/** Providers imported in the browser (Cal with an SMS code); the server only holds their encrypted ID */
export const BROWSER_IMPORT_PROVIDERS = new Set(['visaCalFast']);

/**
 * The household's active connections with server-stored (encrypted) credentials. Connections are
 * shared: any household member can import any of them. Connections imported in the browser (Cal
 * with an SMS code) are left out: the server only keeps their ID for the SMS request.
 * With `connectionId`, returns just that connection or throws if it can't be imported here.
 */
export async function getHouseholdConnections(householdId: string, connectionId?: string): Promise<BankConnection[]> {
  let query = supabase
    .from('bank_connections')
    .select('id, provider, display_name, credentials_encrypted')
    .eq('household_id', householdId)
    .eq('is_active', true)
    .order('created_at', { ascending: true });
  if (connectionId) query = query.eq('id', connectionId);

  const { data, error } = await query;

  if (error) throw new Error(`Failed to fetch bank connections: ${error.message}`);
  if (connectionId && (!data || data.length === 0)) throw new Error('Bank connection not found.');
  if (connectionId && BROWSER_IMPORT_PROVIDERS.has(data![0].provider)) {
    throw new Error('This account is imported in the browser.');
  }
  if (connectionId && !data![0].credentials_encrypted) {
    throw new Error('This account has no securely stored credentials. Remove it and add it again.');
  }
  const importable = (data ?? []).filter((row) => row.credentials_encrypted && !BROWSER_IMPORT_PROVIDERS.has(row.provider));
  if (importable.length === 0) throw new Error('No bank accounts connected. Add a bank account in Settings first.');

  return importable.map((row) => ({
    id: row.id,
    provider: row.provider,
    displayName: row.display_name ?? row.provider,
    credentials: JSON.parse(decrypt(row.credentials_encrypted)),
  }));
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
  // Only the Supabase/bank error text, cut short; never credentials
  error = error?.slice(0, 500);
  const { error: updateError } = await supabase
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
  if (updateError) throw new Error(`Couldn't record the import: ${updateError.message}`);
}

/**
 * The import's record, 'importing' until its rows wait in the holding area ('complete') or it
 * fails ('error'). Its review is finished (reviewed_at) by the person's Import or Cancel.
 */
export async function createImportSessionRecord(
  userId: string,
  householdId: string,
  dateRangeStart: Date,
  dateRangeEnd: Date,
  connectionId?: string
): Promise<string> {
  const { data, error } = await supabase
    .from('bank_import_sessions')
    .insert({
      user_id: userId,
      household_id: householdId,
      status: 'importing',
      bank_connection_id: connectionId ?? null,
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
