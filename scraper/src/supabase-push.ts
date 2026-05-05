import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import type { TransactionRow } from './scraper.js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function makeExternalId(tx: TransactionRow): string {
  const raw = `${tx.date}|${tx.amount}|${tx.description}`;
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
}

export async function pushTransactions(
  userId: string,
  householdId: string,
  transactions: TransactionRow[],
  accountNumber: string
): Promise<{ imported: number; skipped: number }> {
  let imported = 0;
  let skipped = 0;

  for (const tx of transactions) {
    const externalId = makeExternalId(tx);

    // Check for duplicate
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
      date: tx.date,
      description: tx.description,
      amount: Math.abs(tx.amount),
      category: 'Uncategorized',
      type: tx.amount < 0 ? 'expense' : 'income',
      source: 'bank_import',
      external_id: externalId,
      bank_account_number: accountNumber,
    });

    if (error) {
      console.error('Failed to insert transaction:', error.message);
    } else {
      imported++;
    }
  }

  return { imported, skipped };
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
  // The JWT from the frontend is passed as Bearer token.
  // Use it to look up the user and their household.
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
