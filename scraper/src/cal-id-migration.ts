import type { Db } from './staging.js';

export interface CalIdMigrationResult {
  /** Cal connections that still have the ID in plain text */
  found: number;
  /** Those moved to encrypted storage (0 on a dry run) */
  moved: number;
  /** Their connection ids (never the national IDs) */
  connectionIds: string[];
  /** Cal connections with the ID in plain text but no household, left as they are (see the deploy doc) */
  skippedNoHousehold: number;
}

/**
 * Moves each Cal (SMS code) connection's national ID out of the readable `metadata` into the
 * encrypted `credentials_encrypted`, and marks the connection `secure` so the app asks the server
 * for the SMS. Dry run unless `apply`. Each connection is one update, and only while its metadata
 * still holds the ID, so running it again (or twice at once) changes nothing more.
 */
export async function migrateCalIds(
  db: Db,
  { apply, encrypt }: { apply: boolean; encrypt: (plain: string) => string },
): Promise<CalIdMigrationResult> {
  const { data, error } = await db.from('bank_connections').select('id, household_id, metadata').eq('provider', 'visaCalFast');
  if (error) throw new Error(`Couldn't read connections: ${error.message}`);

  const withId = ((data ?? []) as { id: string; household_id: string | null; metadata: Record<string, unknown> | null }[])
    .filter(c => typeof c.metadata?.id === 'string' && (c.metadata.id as string).length > 0);
  // No household: nobody can import it through the service, which checks the household. Left as is
  const pending = withId.filter(c => c.household_id);
  const skippedNoHousehold = withId.length - pending.length;

  let moved = 0;
  if (apply) {
    for (const conn of pending) {
      const { id: nationalId, ...rest } = conn.metadata as Record<string, unknown>;
      const last4Digits = typeof rest.last4Digits === 'string' ? rest.last4Digits : '';
      const { data: updated, error: updateError } = await db
        .from('bank_connections')
        .update({
          credentials_encrypted: encrypt(JSON.stringify({ id: nationalId, last4Digits })),
          metadata: { ...rest, last4Digits, secure: true },
        })
        .eq('id', conn.id)
        .not('household_id', 'is', null)
        .not('metadata->>id', 'is', null)
        .select('id');
      if (updateError) throw new Error(`Couldn't move connection ${conn.id}: ${updateError.message}`);
      if (updated && updated.length > 0) moved++;
    }
  }

  return { found: pending.length, moved, connectionIds: pending.map(c => c.id), skippedNoHousehold };
}
