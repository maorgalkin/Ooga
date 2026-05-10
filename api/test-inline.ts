import type { VercelRequest, VercelResponse } from '@vercel/node';

// Inlined getAdminClient — no local imports
function getAdminClient() {
  const url = process.env.SUPABASE_URL ?? '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  return { url, key, ok: !!(url && key) };
}

export default function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const client = getAdminClient();
    res.json({ ok: true, hasUrl: client.ok });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
