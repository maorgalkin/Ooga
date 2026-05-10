/**
 * Bank connections CRUD — Vercel API function.
 *
 * GET  /api/connections          → list user's connections (no credentials)
 * POST /api/connections          → add a new connection (encrypts credentials)
 * DELETE /api/connections?id=xx  → delete a connection
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminClient, requireAuth, AuthError } from './supabase-admin';
import { encrypt, decrypt } from './crypto-utils';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const userId = await requireAuth(req as any);
    const supabase = getAdminClient();

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('bank_connections')
        .select('id, provider, display_name, last_sync_at, is_active, created_at')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (error) throw new Error(error.message);
      return res.json({ connections: data ?? [] });
    }

    if (req.method === 'POST') {
      const { provider, credentials, displayName } = req.body as {
        provider: string;
        credentials: Record<string, string>;
        displayName?: string;
      };

      if (!provider || !credentials) {
        return res.status(400).json({ error: 'provider and credentials are required' });
      }

      // Get household_id for the user
      const { data: households, error: hhErr } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', userId)
        .limit(1)
        .single();

      if (hhErr || !households) {
        return res.status(400).json({ error: 'No household found for user' });
      }

      const credentials_encrypted = encrypt(JSON.stringify(credentials));

      const { data: conn, error: insErr } = await supabase
        .from('bank_connections')
        .insert({
          user_id: userId,
          household_id: households.household_id,
          provider,
          display_name: displayName ?? provider,
          credentials_encrypted,
          is_active: true,
        })
        .select('id, provider, display_name, last_sync_at, is_active, created_at')
        .single();

      if (insErr) throw new Error(insErr.message);
      return res.status(201).json({ connection: conn });
    }

    if (req.method === 'DELETE') {
      const id = req.query.id as string;
      if (!id) return res.status(400).json({ error: 'id query param required' });

      const { error } = await supabase
        .from('bank_connections')
        .delete()
        .eq('id', id)
        .eq('user_id', userId); // ensure ownership

      if (error) throw new Error(error.message);
      return res.status(204).end();
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(401).json({ error: err.message });
    }
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[connections]', message);
    return res.status(500).json({ error: message });
  }
}

/**
 * Exported helper: load and decrypt credentials for a given connection.
 * Used by import functions.
 */
export async function loadCredentials(
  connectionId: string,
  userId: string
): Promise<Record<string, string>> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('bank_connections')
    .select('credentials_encrypted')
    .eq('id', connectionId)
    .eq('user_id', userId)
    .single();

  if (error || !data) throw new Error('Connection not found');
  return JSON.parse(decrypt(data.credentials_encrypted)) as Record<string, string>;
}
