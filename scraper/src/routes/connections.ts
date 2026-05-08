import { Router, type Request, type Response } from 'express';
import { createScraper, CompanyTypes } from 'israeli-bank-scrapers';
import { getUserAndHousehold, supabase } from '../supabase-push.js';
import { encrypt, decrypt } from '../encryption.js';

const router = Router();

/**
 * POST /connections/add
 * Encrypts and stores a new bank/card connection for the authenticated user.
 * Body: { provider: string, credentials: object, displayName?: string }
 */
router.post('/add', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization ?? '';
    const { userId, householdId } = await getUserAndHousehold(authHeader);

    const { provider, credentials, displayName } = req.body ?? {};

    if (!provider || typeof provider !== 'string') {
      res.status(400).json({ error: 'provider is required' });
      return;
    }
    if (!credentials || typeof credentials !== 'object') {
      res.status(400).json({ error: 'credentials object is required' });
      return;
    }

    const credJson = JSON.stringify(credentials);
    const credentialsEncrypted = encrypt(credJson);

    const { data, error } = await supabase
      .from('bank_connections')
      .insert({
        user_id: userId,
        household_id: householdId,
        provider,
        display_name: displayName ?? provider,
        credentials_encrypted: credentialsEncrypted,
      })
      .select('id, provider, display_name, created_at')
      .single();

    if (error) throw new Error(error.message);

    res.json({ connection: data });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to add connection' });
  }
});

/**
 * DELETE /connections/:id
 * Removes a bank connection owned by the authenticated user.
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization ?? '';
    const { userId } = await getUserAndHousehold(authHeader);

    const { error } = await supabase
      .from('bank_connections')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', userId);

    if (error) throw new Error(error.message);

    res.json({ deleted: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to delete connection' });
  }
});

/**
 * GET /connections/list
 * Lists all active bank connections for the authenticated user (no credentials returned).
 */
router.get('/list', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization ?? '';
    const { userId } = await getUserAndHousehold(authHeader);

    const { data, error } = await supabase
      .from('bank_connections')
      .select('id, provider, display_name, last_sync_at, is_active, created_at')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);

    res.json({ connections: data ?? [] });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to list connections' });
  }
});

/**
 * POST /connections/test/:id
 * Performs a login test with stored credentials (7-day date range, no data written).
 * Returns { success: true } or { success: false, error: string }.
 */
router.post('/test/:id', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization ?? '';
    const { userId } = await getUserAndHousehold(authHeader);

    const { data: conn, error } = await supabase
      .from('bank_connections')
      .select('provider, credentials_encrypted')
      .eq('id', req.params.id)
      .eq('user_id', userId)
      .single();

    if (error || !conn) {
      res.status(404).json({ error: 'Connection not found' });
      return;
    }

    const credentials = JSON.parse(decrypt(conn.credentials_encrypted));
    const companyId = conn.provider as CompanyTypes;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    console.log(`Testing connection for provider: ${companyId}`);
    const scraper = createScraper({
      companyId,
      startDate,
      showBrowser: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const result = await scraper.scrape(credentials as never);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.errorMessage ?? 'Login failed — check your credentials',
      });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err instanceof Error ? err.message : 'Test failed',
    });
  }
});

export default router;
