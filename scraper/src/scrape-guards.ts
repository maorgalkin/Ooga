import type { Db } from './staging.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);

/** Providers imported in the browser (Cal with an SMS code); the server only holds their encrypted ID */
export const BROWSER_IMPORT_PROVIDERS = new Set(['visaCalFast']);

/** A refusal to answer with this HTTP status and message (never database text) */
export class GuardError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/**
 * The household's accounts an import may fetch: the one asked for, or all of them. Checked
 * before anything is locked or recorded, so a bad or foreign id leaves no trace. Accounts imported
 * in the browser, and ones with no stored credentials, are never fetched here.
 */
export async function importableConnectionIds(db: Db, householdId: string, connectionId?: unknown): Promise<string[]> {
  if (connectionId !== undefined && connectionId !== null && !isUuid(connectionId)) {
    throw new GuardError(400, 'connectionId must be a UUID');
  }
  let query = db
    .from('bank_connections')
    .select('id, provider, credentials_encrypted')
    .eq('household_id', householdId)
    .eq('is_active', true);
  if (connectionId) query = query.eq('id', connectionId);
  const { data, error } = await query;
  if (error) throw new GuardError(500, "Couldn't start the import. Try again.");

  const rows = (data ?? []) as { id: string; provider: string; credentials_encrypted: string | null }[];
  if (connectionId) {
    const row = rows[0];
    if (!row) throw new GuardError(404, 'Bank connection not found.');
    if (BROWSER_IMPORT_PROVIDERS.has(row.provider)) throw new GuardError(400, 'This account is imported in the browser.');
    if (!row.credentials_encrypted) throw new GuardError(400, 'This account has no securely stored credentials. Remove it and add it again.');
    return [row.id];
  }
  const ids = rows.filter(r => r.credentials_encrypted && !BROWSER_IMPORT_PROVIDERS.has(r.provider)).map(r => r.id);
  if (ids.length === 0) throw new GuardError(400, 'No bank accounts connected. Add a bank account in Settings first.');
  return ids;
}
