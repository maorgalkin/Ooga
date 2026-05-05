import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import scrapeRouter from './routes/scrape.js';

// Fail fast if required env vars are missing or placeholder
const REQUIRED_VARS: Record<string, string> = {
  SUPABASE_URL: process.env.SUPABASE_URL ?? '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  DISCOUNT_BANK_USERNAME: process.env.DISCOUNT_BANK_USERNAME ?? '',
  DISCOUNT_BANK_PASSWORD: process.env.DISCOUNT_BANK_PASSWORD ?? '',
  DISCOUNT_BANK_NUM: process.env.DISCOUNT_BANK_NUM ?? '',
};
const PLACEHOLDER_PATTERNS = ['your-project.supabase.co', 'your_', 'placeholder', ''];
for (const [name, value] of Object.entries(REQUIRED_VARS)) {
  if (PLACEHOLDER_PATTERNS.some((p) => value === '' || value.includes(p))) {
    console.error(`❌ Missing or placeholder env var: ${name}. Update .env.scraper and restart.`);
    process.exit(1);
  }
}

const app = express();
const PORT = Number(process.env.PORT ?? 3001);
const API_KEY = process.env.SCRAPER_API_KEY;

app.use(cors());
app.use(express.json());

// Health check — no auth required
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'ooga-scraper' });
});

// Simple API key guard for all /scrape/* routes
app.use('/scrape', (req, res, next) => {
  if (!API_KEY) {
    // No key configured — allow all (dev mode)
    next();
    return;
  }
  const provided = req.headers['x-api-key'] ?? req.query['api_key'];
  if (provided !== API_KEY) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
});

app.use('/scrape', scrapeRouter);

app.listen(PORT, () => {
  console.log(`Ooga scraper service running on port ${PORT}`);
});
