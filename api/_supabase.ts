/**
 * Supabase admin client for server-side Vercel API functions.
 * Uses service_role key which bypasses RLS (so we can insert/update on behalf of users).
 */

import { createClient } from '@supabase/supabase-js';

let _admin: ReturnType<typeof createClient> | null = null;

export function getAdminClient() {
  if (!_admin) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars are required');
    }
    _admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  }
  return _admin;
}

/**
 * Validates the user's JWT and returns their user_id.
 * Throws if the token is invalid or missing.
 */
export async function requireAuth(req: { headers: { authorization?: string } }): Promise<string> {
  const authHeader = req.headers.authorization ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) throw new AuthError('Missing Authorization header');

  const admin = getAdminClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new AuthError('Invalid or expired auth token');
  return data.user.id;
}

export class AuthError extends Error {
  status = 401;
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}
