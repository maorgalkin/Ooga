# Bank Import — Discount Bank Integration

## Overview

Ooga can automatically import transactions from Israeli Discount Bank using the open-source [`israeli-bank-scrapers`](https://github.com/eshaham/israeli-bank-scrapers) library. The scraper uses Puppeteer (headless Chrome) to log in to the bank's website, so it runs in a dedicated Docker microservice separate from the frontend.

---

## Architecture

```
[Mobile / Web App]
       │ HTTP REST
       ▼
[Scraper Microservice — Docker]
  Node.js + Express
  israeli-bank-scrapers + Puppeteer
  Credentials via Docker env vars / secrets
       │ Supabase service role key
       ▼
[Supabase PostgreSQL]
  transactions table
  bank_import_sessions table
```

**The scraper service is never exposed to the public internet without an API key.**

---

## Local Development Setup

### 1. Copy and fill in credentials

```bash
cp scraper/.env.example .env.scraper
# Edit .env.scraper with your Discount Bank credentials and Supabase service role key
```

### 2. Start the scraper with Docker Compose

```bash
docker-compose up --build
```

The scraper will be available at `http://localhost:3001`.

### 3. Configure the frontend

Add to your `.env.local`:

```
VITE_SCRAPER_SERVICE_URL=http://localhost:3001
VITE_SCRAPER_API_KEY=   # leave empty for local dev if SCRAPER_API_KEY is empty
```

### 4. Apply the database migration

Run `024_bank_import.sql` in your Supabase SQL editor or via the Supabase CLI:

```bash
supabase db push
```

---

## Import Flow

1. Tap **Import from Bank** in the Transactions tab.
2. Choose how many months to import (1–12).
3. Tap **Start Import** — the scraper logs in to Discount Bank.
4. **Enter the OTP** sent to your phone (120s countdown).
5. Scraper fetches all transactions and pushes them to Supabase.
6. A summary screen shows how many transactions were imported and how many duplicates were skipped.

All imported transactions are assigned the category **Uncategorized** and the source flag `bank_import`. Categorize them using the normal transaction editing flow.

**Duplicate detection:** A transaction is considered a duplicate if the same user has an existing transaction with the same `date + amount + description` hash. Duplicates are silently skipped.

---

## Production Deployment

The scraper service is a standard Docker container. You can deploy it to:

| Provider | Notes |
|---|---|
| **Railway** | `railway up` — easiest, free tier available |
| **Fly.io** | `fly deploy` — good for always-on services |
| **Render** | Docker deploy via web UI |
| **Self-hosted VPS** | `docker-compose up -d` |

### Environment variables to set in production

| Variable | Description |
|---|---|
| `DISCOUNT_BANK_USERNAME` | Your Discount Bank ID number |
| `DISCOUNT_BANK_PASSWORD` | Your Discount Bank password |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `SCRAPER_API_KEY` | A long random string — set the same value in `VITE_SCRAPER_API_KEY` on Vercel |
| `PORT` | Default: `3001` |

### Frontend env vars (Vercel)

| Variable | Value |
|---|---|
| `VITE_SCRAPER_SERVICE_URL` | Your deployed scraper URL |
| `VITE_SCRAPER_API_KEY` | Same as `SCRAPER_API_KEY` above |

---

## Security Notes

- **Credentials are only stored as Docker env vars / secrets** — never in Supabase or the frontend.
- The scraper service uses a Supabase **service role key** to insert transactions. This key bypasses Row Level Security — never expose it to clients.
- The `SCRAPER_API_KEY` is a simple bearer token to prevent unauthorised callers from triggering imports. For production, always set a strong random value.
- The scraper service logs **never** log credentials. Puppeteer runs headless with no screenshots saved.

---

## Troubleshooting

| Problem | Solution |
|---|---|
| "Session not found or expired" | Sessions expire after 10 minutes. Start a new import. |
| OTP expired (countdown reaches 0) | Close the modal and start again. |
| Scraper fails at login | Check credentials in `.env.scraper`. Discount Bank may have updated its site — check the [library's GitHub issues](https://github.com/eshaham/israeli-bank-scrapers/issues). |
| Docker build fails | Ensure Docker has enough memory (≥2GB). Puppeteer needs Chromium. |

---

## Future Work

- **Auto-category mapping** — match bank transaction descriptions to Ooga categories using keyword rules
- **Scheduled imports** — cron-triggered automatic sync
- **Multi-bank support** — Leumi, Hapoalim, and others via the same library
- **Multi-account selection** — choose which bank accounts to import (checking, savings, credit card)
