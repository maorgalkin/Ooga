import type { VercelRequest, VercelResponse } from '@vercel/node';

// Step 1: does importing @supabase/supabase-js crash?
import { createClient } from '@supabase/supabase-js';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  const c = createClient('https://x.supabase.co', 'fake');
  res.json({ ok: true, ts: Date.now(), hasClient: !!c, commit: '8e83417' });
}
