import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createClient } = require('@supabase/supabase-js');
    const c = createClient('https://x.supabase.co', 'fake');
    res.json({ ok: true, node: process.version, hasClient: !!c, commit: '29f7471' });
  } catch (err) {
    res.status(500).json({ error: String(err), node: process.version });
  }
}
