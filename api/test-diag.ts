import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminClient } from './_lib/supabase-admin';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const client = getAdminClient();
    res.json({ ok: true, hasFrom: typeof client.from });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
