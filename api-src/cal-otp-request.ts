/**
 * Step 1 of Cal Fast Access import: trigger SMS OTP.
 *
 * POST /api/cal-otp-request
 * Body: { connectionId: string }   — identifies which bank_connection to use
 * Response: { calSessionToken: string }  — UUID to send with OTP verification
 *
 * Reads userId+last4Digits from the stored bank_connection credentials,
 * calls Cal's PUT /otp endpoint, and returns the session token.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, AuthError } from '../lib/supabase-admin';
import { loadCredentials } from '../lib/bank-helpers';

const OTP_URL = 'https://connect.cal-online.co.il/col-rest/calconnect/authentication/otp';
const SEND_OTP_PAGE = 'https://connect.cal-online.co.il/send-otp';
const AUTH_SITE_ID = '5B5160DD-F84A-4D72-B67E-65891BA194FF';

const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * BIG-IP cookie challenge flow:
 * 1. GET /send-otp → BIG-IP returns 302 with Set-Cookie: TS=<challenge>
 * 2. Follow redirect manually WITH the TS cookie → BIG-IP validates + allows
 * 3. Use that TS cookie in the subsequent PUT request
 *
 * Node fetch doesn't carry cookies across redirects, so we handle manually.
 */
async function getBigIpCookie(): Promise<{ cookie: string; diagnostics: Record<string, unknown> }> {
  const cookieJar: Record<string, string> = {};
  const diagnostics: Record<string, unknown> = {};
  let url = SEND_OTP_PAGE;

  for (let hop = 0; hop < 6; hop++) {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'user-agent': BROWSER_UA,
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'accept-language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
        'cookie': Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join('; '),
      },
      redirect: 'manual',
    });

    diagnostics[`hop${hop}`] = { status: res.status, url };

    // Collect Set-Cookie headers
    const setCookie = res.headers.get('set-cookie') ?? '';
    if (setCookie) {
      for (const part of setCookie.split(/,(?=[^;]+=[^;]*)/)) {
        const m = part.trim().match(/^([^=]+)=([^;]*)/);
        if (m) cookieJar[m[1].trim()] = m[2].trim();
      }
    }

    if (res.status >= 200 && res.status < 300) break;

    if (res.status >= 300 && res.status < 400) {
      let loc = res.headers.get('location') ?? '';
      if (loc.startsWith('/')) loc = 'https://connect.cal-online.co.il' + loc;
      url = loc || url;
    } else {
      // Unexpected status — stop
      diagnostics['blocked'] = { status: res.status, body: (await res.text()).slice(0, 200) };
      break;
    }
  }

  const tsKey = Object.keys(cookieJar).find(k => k.startsWith('TS'));
  const cookie = tsKey ? `${tsKey}=${cookieJar[tsKey]}` : '';
  diagnostics['cookies'] = Object.keys(cookieJar);
  console.log('[cal-otp-request] Cookie fetch diagnostics:', JSON.stringify(diagnostics));
  return { cookie, diagnostics };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const userId = await requireAuth(req as any);
    const { connectionId } = req.body as { connectionId?: string };
    if (!connectionId) return res.status(400).json({ error: 'connectionId is required' });

    // Load and decrypt stored credentials { id (national ID), last4Digits }
    // The field is stored as 'id' by AddBankAccountModal (key: 'id' for national ID)
    const creds = await loadCredentials(connectionId, userId);
    const calUserId = creds.id ?? creds.userId; // 'id' is the national ID field
    const { last4Digits } = creds;
    if (!calUserId || !last4Digits) {
      return res.status(400).json({ error: 'Stored credentials missing userId or last4Digits' });
    }

    // Step 1: Get BIG-IP TS session cookie (required by F5 WAF on connect.cal-online.co.il)
    const { cookie: tsCookie, diagnostics: cookieDiag } = await getBigIpCookie();

    // Step 2: PUT /otp — sends SMS to the user's phone
    const calRes = await fetch(OTP_URL, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-site-id': AUTH_SITE_ID,
        'origin': 'https://connect.cal-online.co.il',
        'referer': 'https://connect.cal-online.co.il/send-otp',
        'user-agent': BROWSER_UA,
        ...(tsCookie ? { 'cookie': tsCookie } : {}),
      },
      body: JSON.stringify({
        userId: calUserId,
        last4Digits,
        bankAccountNum: last4Digits,
        sMSTemplate: null,
        recaptcha: '',
      }),
    });

    const rawText = await calRes.text();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let body: any = {};
    try { body = JSON.parse(rawText); } catch { /* non-JSON body */ }

    if (!calRes.ok) {
      console.error('[cal-otp-request] Cal API error:', calRes.status, rawText.slice(0, 500));
      return res.status(502).json({
        error: 'Cal API rejected OTP request',
        calStatus: calRes.status,
        detail: body,
        rawPreview: rawText.slice(0, 300),
        cookieDiag,
      });
    }

    // Cal returns the session token — try multiple possible field names
    const calSessionToken =
      body.token ??
      body.result?.token ??
      body.data?.token ??
      body.sessionToken ??
      body.result?.sessionToken;

    if (!calSessionToken) {
      console.error('[cal-otp-request] Unexpected response shape:', JSON.stringify(body));
      return res.status(502).json({
        error: 'Could not find session token in Cal response',
        debug_response: body, // expose to help discover field name
      });
    }

    return res.json({ calSessionToken });
  } catch (err) {
    if (err instanceof AuthError) return res.status(401).json({ error: err.message });
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[cal-otp-request]', message);
    return res.status(500).json({ error: message });
  }
}
