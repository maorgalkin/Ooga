import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    // Test 1: crypto built-in
    const iv = randomBytes(12).toString('hex');

    // Test 2: Supabase createClient (don't actually connect)
    const client = createClient('https://example.supabase.co', 'fake-key', {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    res.json({ ok: true, iv, hasClient: !!client });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
