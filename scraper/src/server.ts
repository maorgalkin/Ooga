import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import scrapeRouter from './routes/scrape.js';

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
