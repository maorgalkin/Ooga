import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import scrapeRouter from './routes/scrape.js';
import connectionsRouter from './routes/connections.js';

// Fail fast if required env vars are missing or placeholder
const REQUIRED_VARS: Record<string, string> = {
  SUPABASE_URL: process.env.SUPABASE_URL ?? '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY ?? '',
};
const PLACEHOLDER_PATTERNS = ['your-project.supabase.co', 'your_', 'placeholder'];
for (const [name, value] of Object.entries(REQUIRED_VARS)) {
  if (!value || PLACEHOLDER_PATTERNS.some((p) => value.includes(p))) {
    console.error(`❌ Missing or placeholder env var: ${name}. Update .env.scraper and restart.`);
    process.exit(1);
  }
}

const ENCRYPTION_KEY_HEX = process.env.ENCRYPTION_KEY!;
if (ENCRYPTION_KEY_HEX.length !== 64) {
  console.error('❌ ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). Generate with: openssl rand -hex 32');
  process.exit(1);
}

const app = express();
const PORT = Number(process.env.PORT ?? 3001);
const API_KEY = process.env.SCRAPER_API_KEY;

app.use(cors({
  origin: ['https://galfin.vercel.app', 'https://ooga.vercel.app', 'http://localhost:5173'],
  credentials: true,
}));
app.use(express.json());

// Request logger for debugging
app.use((req, _res, next) => {
  console.log(`→ ${req.method} ${req.path}`);
  next();
});

// Health check — no auth required
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'ooga-scraper' });
});

// Simple API key guard for protected routes
function apiKeyGuard(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!API_KEY) {
    next();
    return;
  }
  const provided = req.headers['x-api-key'] ?? req.query['api_key'];
  if (provided !== API_KEY) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

app.use('/scrape', apiKeyGuard, scrapeRouter);
app.use('/connections', apiKeyGuard, connectionsRouter);

app.listen(PORT, () => {
  console.log(`Ooga scraper service running on port ${PORT}`);
});
