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
VITE_SCRAPER_URL=http://localhost:3001
```

Without it, the app uses the production scraper at `https://api.haooga.com`. Access the app at `http://localhost:5173`.

### 6. Connect your accounts

Go to **Budget → Settings → Connected Accounts** → **Add Account**.  
Choose your provider, enter credentials, and click **Test & Save**.

---

## Import Flow

1. **Start it:** Add transaction → a connected account under "Import transactions" (or the account's import in Settings). Choose the period, then send the code (Visa Cal) or start the import (accounts the import service logs in to).
2. **Fetch:** the bank's rows are read and compared with what the household already has:
   - **Already there:** rows any member imported before. They're skipped and listed in the "skipped" bubble.
   - **Already there, but changed:** a pending charge that's now billed, or a foreign amount now charged in shekels. These update the stored row straight away; that's bookkeeping on a row that's already in the budget, not a new decision.
   - **New:** wait in the **holding area** (`import_staged_rows`, migration 041) and aren't in the budget yet.
   - **Deleted earlier:** rows a household member deleted on purpose (they have a tombstone in `import_tombstones`). They wait in the holding area too, **unticked**, tagged "Deleted earlier".
3. **Review:** the waiting rows, with a category picker for each. Before anything is imported, the review also previews which manual "Paid with" entries the rows will join.
   - **Import N:** first plans the ticked rows again against what's stored *now* (`commitImportWithReplan`). Rows can wait while another import stores the same charge, possibly as its pending or billed version under another key, which the database's unique keys can't catch:
     - a waiting billed row whose pending version is stored updates that row ("updated");
     - a waiting pending row whose billed version is stored, or a row stored meanwhile, counts as "already imported".

     Then one step in the database (`commit_import`): what's still new moves into transactions, each joined to the "Paid with" entry it matched (`entry_id`; a failed join leaves the row on its own, `imported_not_joined`), rows deleted earlier lose their tombstone, rows a member deleted after the fetch stay out (`deleted_meanwhile`), and the holding area empties. Before migration 042 the database doesn't join, and the browser joins the rows right after. Import is disabled when nothing is ticked, in both review modes.
   - Import also cancels the person's own holding areas left unreviewed for 14 days (`cleanup_stale_import_holding`, 042); their rows come back with the next fetch.
   - **Unticked rows are "not now":** they're not imported, and the next import offers them again.
   - **Finish later** (or closing the window): the rows keep waiting. The Dashboard shows "Unfinished imports", and Review reopens them. A new fetch of the same account cancels the person's older postponed imports of it, so one charge never waits twice.
   - **Cancel import:** the holding area empties, and nothing ever reached the budget.
4. **Summary:** how many were imported, skipped, or already imported by someone else.

Only the person who fetched an import sees its holding area. Imports are recorded in `bank_import_sessions` (`importing` → `complete` or `error`; `cancelled`; `reviewed_at` once imported or cancelled). Cancelling claims the session (`reviewed_at` still empty) before emptying it, so it can't race an Import running elsewhere. An import that stopped while fetching (still `importing` after 10 minutes, with rows waiting) also shows as unfinished; Review marks it fetched first.

### Known gaps

- **Until migration 042 is applied, joins to "Paid with" entries run in the browser after `commit_import`.** If the tab closes in between, those rows count twice until merged by hand. With 042 they're joined in the same step.
- **Abandoned holding areas are cleared only when their owner next presses Import** (after 14 days). Someone who never imports again keeps an invisible holding area until then.
- **Imports through the import service (Discount) use the holding area once the updated scraper is deployed.** Until then the app keeps today's review for them: it tells the two apart by the service's answer (`result.mode === 'staged'`).
- **Cal connections added before the ID moved to the import service keep it in `metadata` until the one-off move** (`migrate-cal-ids`, see [SCRAPER_DEPLOY.md](SCRAPER_DEPLOY.md)). Until then they sign in from the browser as before.

A pending charge merged into a "Paid with" entry is paired with its billed version by the bank row's own description, kept in the entry's `merge_snapshot`; the billed update keeps the entry's description, category and memo and updates the snapshot, so undoing the merge restores the billed charge.

**Imports through the import service (Discount)** stage their rows the same way (`scraper/src/staging.ts`): the service records the import (`importing` → `complete`, with the account), keeps new and deleted-earlier rows in the holding area under their `external_id`, and reports the rest as already there. It runs one import per account at a time (a second gets 409), marks the account synced only when its rows were kept, and replaces the person's older postponed imports of the account. Their rows have no pending/billed versions, so Import's re-plan passes them straight to `commit_import`, whose unique keys catch any stored meanwhile.

**Still writing straight to transactions:** a scraper older than this change, and browser imports before migration 041. There, the review is of rows already in the budget: unticked rows are deleted, and closing the window undoes the import.

Imported rows start **Uncategorized**, with `source = 'bank_import'`. Duplicates are recognised household-wide by `dedupe_hash` (browser imports) or `external_id` (import service), each with a unique index.

---

## Production Deployment

The scraper service runs as a Docker container on a Vultr server in Tel Aviv, behind nginx with HTTPS at `https://api.haooga.com`. The web app calls it there by default. See [SCRAPER_DEPLOY.md](SCRAPER_DEPLOY.md) for the server layout and the deploy routine (`/deploy-scraper` in Claude Code).

### Environment variables (production)

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (bypasses RLS) |
| `ENCRYPTION_KEY` | 64-character hex string — generate with `openssl rand -hex 32` |
| `SCRAPER_API_KEY` | Optional bearer token to protect the scraper endpoints |
| `ALLOWED_ORIGINS` | Optional CORS allow-list (comma-separated). Defaults to haooga.com, www.haooga.com and localhost:5173 |
| `PORT` | Default: `3001` |

### Pointing the web app at a scraper

The web app reads `VITE_SCRAPER_URL` and defaults to `https://api.haooga.com`. For local development, run the scraper with `docker compose up --build` and set `VITE_SCRAPER_URL=http://localhost:3001` in `.env.local`.

---

## Security Notes

- **Credentials encrypted at rest**: AES-256-GCM with a key that lives only in the scraper's environment. Supabase stores only the ciphertext + IV + auth tag.
- **Visa Cal's national ID** is stored the same way (`credentials_encrypted`, with `metadata.secure`; only the card's last 4 digits stay readable). The SMS sign-in goes through the import service (`POST /cal/otp/request`, `POST /cal/otp/verify`): it decrypts the ID for those two calls to Cal and returns only Cal's handle and short-lived token. Any member of the account's household may start it; the code still goes to the cardholder's phone. Transactions are then fetched in the browser, so none pass through the service.
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

