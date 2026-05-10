/**
 * Ooga Local Relay — runs on your Mac to proxy Cal bank requests.
 *
 * WHY: Cal's OTP API (connect.cal-online.co.il) blocks Vercel's datacenter IPs.
 *      This relay runs on your machine (residential IP), so Cal accepts the request.
 *
 * USAGE:
 *   node --env-file=.env.relay relay.js
 *
 * REQUIRED env vars (put in .env.relay):
 *   SUPABASE_URL              — e.g. https://xxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY — service role key (not anon!)
 *   ENCRYPTION_KEY            — 64-char hex (same value set in Vercel)
 *
 * OPTIONAL:
 *   RELAY_PORT   — default 9191
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import calOtpHandler from '../api-src/cal-otp-request';
import calImportHandler from '../api-src/cal-import';

const PORT = parseInt(process.env.RELAY_PORT ?? '9191', 10);

// ─── Adapter: plain Node.js req/res → Vercel-compatible shapes ───────────────

function makeVercelReq(nodeReq: IncomingMessage, body: unknown) {
  return {
    method: nodeReq.method ?? 'GET',
    headers: nodeReq.headers as Record<string, string>,
    body,
  };
}

function makeVercelRes(nodeRes: ServerResponse) {
  let code = 200;
  const res = {
    setHeader: (name: string, val: string | string[]) => { nodeRes.setHeader(name, val); return res; },
    status: (c: number) => { code = c; return res; },
    json: (body: unknown) => {
      if (!nodeRes.headersSent) {
        nodeRes.writeHead(code, { 'Content-Type': 'application/json' });
      }
      nodeRes.end(JSON.stringify(body));
      return res;
    },
    end: () => {
      if (!nodeRes.headersSent) nodeRes.writeHead(code);
      nodeRes.end();
      return res;
    },
  };
  return res;
}

// ─── Body reader ─────────────────────────────────────────────────────────────

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk: Buffer) => { raw += chunk.toString(); });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

// ─── HTTP server ──────────────────────────────────────────────────────────────

const server = createServer(async (nodeReq: IncomingMessage, nodeRes: ServerResponse) => {
  // CORS — allow the Vercel app and localhost dev
  nodeRes.setHeader('Access-Control-Allow-Origin', '*');
  nodeRes.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  nodeRes.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (nodeReq.method === 'OPTIONS') {
    nodeRes.writeHead(204);
    nodeRes.end();
    return;
  }

  const url = (nodeReq.url ?? '/').split('?')[0].replace(/^\/api/, '');
  const body = await readBody(nodeReq).catch(() => ({}));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const req = makeVercelReq(nodeReq, body) as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = makeVercelRes(nodeRes) as any;

  if (url === '/cal-otp-request') {
    await calOtpHandler(req, res);
  } else if (url === '/cal-import') {
    await calImportHandler(req, res);
  } else {
    nodeRes.writeHead(404, { 'Content-Type': 'application/json' });
    nodeRes.end(JSON.stringify({ error: 'Not found. Use /cal-otp-request or /cal-import' }));
  }
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`✗ Port ${PORT} already in use. Try: RELAY_PORT=9192 node relay.js`);
  } else {
    console.error('Relay server error:', err.message);
  }
  process.exit(1);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✓ Ooga relay running → http://localhost:${PORT}`);
  console.log(`  Cal OTP requests proxy through this machine's residential IP.`);
  console.log(`  Keep this terminal open while importing transactions.\n`);
});
