import { Router, type Request, type Response } from 'express';
import {
  createSession,
  getSession,
  updateSession,
} from '../session-manager.js';
import { startScrape } from '../scraper.js';
import { getUserAndHousehold } from '../supabase-push.js';

const router = Router();

/**
 * POST /scrape/start
 * Initiates a new bank scrape session.
 * Body: { months?: number }  (default: 3 months back from today)
 */
router.post('/start', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization ?? '';
    const { userId, householdId } = await getUserAndHousehold(authHeader);

    const months: number = req.body?.months ?? 3;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const session = createSession();

    // Run the scrape asynchronously — don't await here
    startScrape(session.id, userId, householdId, startDate, endDate).catch(
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
router.post('/otp', (req: Request, res: Response) => {
  const { sessionId, code } = req.body ?? {};

  if (!sessionId || !code) {
    res.status(400).json({ error: 'sessionId and code are required' });
    return;
  }

  const session = getSession(sessionId);
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
router.get('/status/:sessionId', (req: Request, res: Response) => {
  const session = getSession(req.params.sessionId);

  if (!session) {
    res.status(404).json({ error: 'Session not found or expired' });
    return;
  }

  res.json({
    sessionId: session.id,
    status: session.status,
    result: session.result ?? null,
    error: session.error ?? null,
  });
});

export default router;
