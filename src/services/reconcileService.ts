/**
 * After an import: pair the new bank rows with manual entries awaiting them ("paid with" a
 * connected account), merge the unambiguous ones and return the rest as suggestions.
 * Merges and undos run in the database (merge_bank_transaction / unmerge_bank_transaction,
 * migration 038) so each is a single transaction.
 */

import { supabase } from '../lib/supabase';
import { matchEntriesToBankRows, type MatchableRow } from '../utils/placeholderMatching';

interface RowSummary {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
}

export interface MatchedEntry {
  entry: RowSummary; // the manual entry, as it was before the merge
  bank: RowSummary;  // the bank row that was merged into it
}

export interface ReconcileResult {
  merged: MatchedEntry[];
  suggestions: MatchedEntry[];
}

type Row = RowSummary & {
  bank_connection_id?: string | null;
  paid_with_connection_id?: string | null;
  installment_number: number | null;
  installment_total: number | null;
};

const summary = (row: Row): RowSummary => ({
  id: row.id,
  date: row.date,
  description: row.description,
  amount: Number(row.amount),
  type: row.type,
});

const toMatchable = (row: Row, connectionId: string | null | undefined): MatchableRow => ({
  id: row.id,
  date: row.date,
  amount: Number(row.amount),
  type: row.type,
  connectionId: connectionId ?? null,
  installmentNumber: row.installment_number,
  installmentTotal: row.installment_total,
});

const shiftDays = (isoDate: string, days: number) =>
  new Date(Date.parse(`${isoDate}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

export async function reconcileImport(dbSessionId: string): Promise<ReconcileResult> {
  const empty: ReconcileResult = { merged: [], suggestions: [] };

  const { data: bankData, error: bankError } = await supabase
    .from('transactions')
    .select('id, date, description, amount, type, bank_connection_id, installment_number, installment_total')
    .eq('import_session_id', dbSessionId);
  if (bankError || !bankData?.length) return empty;
  const bankRows = bankData as Row[];

  const connectionIds = [...new Set(bankRows.map(r => r.bank_connection_id).filter((id): id is string => !!id))];
  if (connectionIds.length === 0) return empty;

  // Entries awaiting these accounts, around the imported dates (installment rows can sit at the
  // start of the month while the charge is dated later in it)
  const dates = bankRows.map(r => r.date).sort();
  const { data: entryData, error: entryError } = await supabase
    .from('transactions')
    .select('id, date, description, amount, type, paid_with_connection_id, installment_number, installment_total')
    .eq('source', 'manual')
    .in('paid_with_connection_id', connectionIds)
    .gte('date', shiftDays(dates[0], -40))
    .lte('date', shiftDays(dates[dates.length - 1], 10));
  if (entryError || !entryData?.length) return empty; // e.g. before migration 038
  const entries = entryData as Row[];

  const { autoMerge, suggestions } = matchEntriesToBankRows(
    bankRows.map(r => toMatchable(r, r.bank_connection_id)),
    entries.map(r => toMatchable(r, r.paid_with_connection_id))
  );

  const bankById = new Map(bankRows.map(r => [r.id, r]));
  const entryById = new Map(entries.map(r => [r.id, r]));
  const describe = (p: { entryId: string; bankId: string }): MatchedEntry => ({
    entry: summary(entryById.get(p.entryId)!),
    bank: summary(bankById.get(p.bankId)!),
  });

  const merged: MatchedEntry[] = [];
  const unmerged: MatchedEntry[] = [];
  for (const pair of autoMerge) {
    try {
      await mergeBankIntoEntry(pair.entryId, pair.bankId);
      merged.push(describe(pair));
    } catch {
      unmerged.push(describe(pair)); // leave it to the user
    }
  }

  return { merged, suggestions: [...unmerged, ...suggestions.map(describe)] };
}

export async function mergeBankIntoEntry(entryId: string, bankId: string): Promise<void> {
  const { error } = await supabase.rpc('merge_bank_transaction', { p_entry_id: entryId, p_bank_id: bankId });
  if (error) throw new Error(error.message);
}

export async function undoMerge(entryId: string): Promise<void> {
  const { error } = await supabase.rpc('unmerge_bank_transaction', { p_entry_id: entryId });
  if (error) throw new Error(error.message);
}

/** Undo every merge made by an import (used when the import is cancelled or its review closed) */
export async function undoMergesForSession(dbSessionId: string): Promise<void> {
  const { data } = await supabase
    .from('transactions')
    .select('id')
    .eq('merge_snapshot->bank_row->>import_session_id', dbSessionId);
  for (const row of (data ?? []) as { id: string }[]) {
    await undoMerge(row.id);
  }
}
