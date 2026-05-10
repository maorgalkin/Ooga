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
const AUTH_SITE_ID = '5B5160DD-F84A-4D72-B67E-65891BA194FF';

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

    // PUT /otp — sends SMS to the user's phone
    const calRes = await fetch(OTP_URL, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-site-id': AUTH_SITE_ID,
        'origin': 'https://connect.cal-online.co.il',
        'referer': 'https://connect.cal-online.co.il/send-otp',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({
        userId: calUserId,
        last4Digits,
        bankAccountNum: last4Digits,
        sMSTemplate: null,
        recaptcha: '',
      }),
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = await calRes.json().catch(() => ({})) as any;

    if (!calRes.ok) {
      console.error('[cal-otp-request] Cal API error:', calRes.status, body);
      return res.status(502).json({
        error: 'Cal API rejected OTP request',
        detail: body,
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
