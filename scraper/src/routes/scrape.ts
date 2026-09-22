import { Router, type Request, type Response } from 'express';
import {
  createSession,
  getSession,
  updateSession,
} from '../session-manager.js';
import { startScrape } from '../scraper.js';
import { getUserAndHousehold } from '../supabase-push.js';

const router = Router();

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The session, if it exists and belongs to the caller */
async function getOwnSession(req: Request) {
  const { userId } = await getUserAndHousehold(req.headers.authorization ?? '');
  const session = getSession(String(req.params.sessionId ?? req.body?.sessionId ?? ''));
  return session && session.userId === userId ? session : undefined;
}

/**
 * POST /scrape/start
 * Initiates a new bank scrape session.
 * Body: {
 *   connectionId?: string,          // import one connection (default: all with stored credentials)
 *   startDate?: 'YYYY-MM-DD',       // default: `months` back from today
 *   endDate?: 'YYYY-MM-DD',         // default: today
 *   months?: number                 // default: 3
 * }
 */
router.post('/start', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization ?? '';
    const { userId, householdId } = await getUserAndHousehold(authHeader);

    const { connectionId, startDate: startParam, endDate: endParam } = req.body ?? {};
    if ((startParam && !ISO_DATE.test(startParam)) || (endParam && !ISO_DATE.test(endParam))) {
      res.status(400).json({ error: 'startDate/endDate must be YYYY-MM-DD' });
      return;
    }

    const months: number = req.body?.months ?? 3;
    const endDate = endParam ? new Date(`${endParam}T23:59:59Z`) : new Date();
    const startDate = startParam ? new Date(`${startParam}T00:00:00Z`) : new Date();
    if (!startParam) startDate.setMonth(startDate.getMonth() - months);

    const session = createSession(userId);

    // Run the scrape asynchronously — don't await here
    startScrape(session.id, userId, householdId, startDate, endDate, connectionId).catch(
      (err) => {
        console.error('Unhandled scrape error:', err);
        updateSession(session.id, {
          status: 'error',
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    );

    res.json({ sessionId: session.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to start import';
    res.status(400).json({ error: msg });
  }
});

/**
 * POST /scrape/otp
 * Submits the OTP code for a session awaiting it.
 * Body: { sessionId: string, code: string }
 */
router.post('/otp', async (req: Request, res: Response) => {
  const { sessionId, code } = req.body ?? {};

  if (!sessionId || !code) {
    res.status(400).json({ error: 'sessionId and code are required' });
    return;
  }

  const session = await getOwnSession(req).catch(() => undefined);
  if (!session) {
    res.status(404).json({ error: 'Session not found or expired' });
    return;
  }

  if (session.status !== 'awaiting_otp' || !session.otpResolver) {
    res.status(409).json({ error: 'Session is not awaiting OTP' });
    return;
  }

  // Resolve the OTP promise in the scraper
  session.otpResolver(String(code));
  updateSession(sessionId, { status: 'importing', otpResolver: undefined });

  res.json({ status: 'importing' });
});

/**
 * GET /scrape/status/:sessionId
 * Returns the current status of a scrape session.
 */
router.get('/status/:sessionId', async (req: Request, res: Response) => {
  const session = await getOwnSession(req).catch(() => undefined);

  if (!session) {
    res.status(404).json({ error: 'Session not found or expired' });
    return;
  }

  res.json({
    sessionId: session.id,
    dbSessionId: session.dbSessionId ?? null,
    status: session.status,
    result: session.result ?? null,
    error: session.error ?? null,
  });
});

export default router;
