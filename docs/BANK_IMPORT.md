# Bank Import — Multi-Provider Integration

## Overview

Ooga can automatically import transactions from Israeli banks and credit cards using the open-source [`israeli-bank-scrapers`](https://github.com/eshaham/israeli-bank-scrapers) library. The scraper uses Puppeteer (headless Chrome) to log in to each institution's website.

A dedicated Docker microservice handles scraping. Credentials are stored encrypted in Supabase — never in plaintext.

---

## What Data Is Available

| Source | What you get |
|---|---|
| **Discount Bank** (checking account) | Salary, rent, ATM, lump-sum credit card debit |
| **Visa Cal / Isracard / Max** (credit cards) | Individual merchant transactions, installment details, foreign currency, charge date |

For household budgeting, connecting your credit card gives the richest data (individual merchants, installment breakdown).

---

## Supported Providers

| Provider | `companyId` | Credentials |
|---|---|---|
| Discount Bank | `discount` | National ID, password, access code (קוד גישה) |
| Visa Cal | `visaCal` | Username, password |
| Isracard | `isracard` | National ID, last 6 card digits, password |
| Amex Israel | `amex` | National ID, last 6 card digits, password |
| Max (Leumi Card) | `max` | Username, password |
| Bank Hapoalim | `hapoalim` | User code, password |
| Bank Leumi | `leumi` | Username, password |

---

## Architecture

```
[React App / Settings → Connected Accounts]
  ↕ Add / delete / test connections
  ↕ "Import from Bank" button
        │
        ▼
[Scraper Microservice — Docker]
  Node.js + Express
  israeli-bank-scrapers + Puppeteer
  AES-256-GCM credential encryption
        │ Supabase service role key
        ▼
[Supabase PostgreSQL]
  bank_connections — encrypted per-user credentials
  transactions — extended with credit-card fields
  bank_import_sessions — import audit log
```

---

## Local Development Setup

### 1. Generate an encryption key

```bash
openssl rand -hex 32
```

### 2. Copy and fill in `scraper/.env.scraper`

```bash
cp scraper/.env.example scraper/.env.scraper
# Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ENCRYPTION_KEY
```

The `ENCRYPTION_KEY` is the 64-character hex string from step 1.

### 3. Apply the DB migrations

Run `024_bank_import.sql` and `025_bank_connections.sql` in your Supabase SQL editor:

```bash
supabase db push
```

### 4. Start the scraper with Docker

```bash
docker-compose up --build
```

Scraper will be available at `http://localhost:3001`.

### 5. Configure the frontend

Add to `.env.local`:

```
VITE_SCRAPER_SERVICE_URL=http://localhost:3001
```

Access the app at `http://localhost:5173` (bank import requires local dev — see below).

### 6. Connect your accounts

Go to **Budget → Settings → Connected Accounts** → **Add Account**.  
Choose your provider, enter credentials, and click **Test & Save**.

---

## Import Flow

1. Click **Import from Bank** in the Transactions tab.
2. Choose the import period (1–12 months).
3. Click **Start Import** — all connected accounts are scraped in parallel.
4. A summary shows how many transactions were imported and how many duplicates were skipped.

All imported transactions are assigned **Uncategorized** and `source = 'bank_import'`.

**Duplicate detection:** SHA-256 of `date + chargedAmount + description`. Same user + same hash = skipped.

---

## Production Deployment

The scraper service is a standard Docker container deployable to Railway, Fly.io, Render, or a VPS.

### Environment variables (production)

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (bypasses RLS) |
| `ENCRYPTION_KEY` | 64-character hex string — generate with `openssl rand -hex 32` |
| `SCRAPER_API_KEY` | Optional bearer token to protect the scraper endpoints |
| `PORT` | Default: `3001` |

### Why bank import requires local dev (for now)

The app is deployed on Vercel (HTTPS). Calling an HTTP Docker service from an HTTPS page is blocked by browser mixed-content rules. Solutions:
- **Local**: Access via `http://localhost:5173` with `VITE_SCRAPER_SERVICE_URL=http://localhost:3001`
- **Production**: Deploy the Docker service with HTTPS (Railway/Fly.io provide this automatically) and set `VITE_SCRAPER_SERVICE_URL` on Vercel

---

## Security Notes

- **Credentials encrypted at rest**: AES-256-GCM with a key that lives only in the scraper's environment. Supabase stores only the ciphertext + IV + auth tag.
- **Service role key**: Never exposed to clients. The scraper is the only service that holds it.
- **Credential isolation**: Each user's credentials are separate rows — household members cannot see each other's bank credentials.
- **No logging of credentials**: Puppeteer runs headless, no screenshots.

---

## Troubleshooting

| Problem | Solution |
|---|---|
| "No accounts connected" | Add an account in Settings → Connected Accounts first |
| Connection test fails | Check your credentials on the bank's website. Ensure the scraper Docker is running. |
| "Missing or placeholder env var: ENCRYPTION_KEY" | Add ENCRYPTION_KEY to `scraper/.env.scraper` (64 hex chars) |
| Docker build fails | Ensure Docker has ≥2GB memory. Puppeteer needs Chromium. |
| Import returns 0 transactions | The date range may have no data. Try a longer period. |
| Partial errors in import | One scraper failed but others succeeded. Check Docker logs for details. |

