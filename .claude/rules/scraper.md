---
paths:
  - "scraper/**"
  - "docker-compose*.yml"
---

# Bank scraper service (`scraper/`)

- Node 22, ESM, TypeScript built with `tsc` into `dist/`. Relative imports end in `.js` (`import { x } from './scraper.js'`) because Node runs the compiled output.
- Every route authenticates the caller with `getUserAndHousehold(req.headers.authorization)` from `supabase-push.ts` (validates the Supabase JWT, then resolves the household). New routes do the same; `SCRAPER_API_KEY` is only for non-browser callers.
- This is the only code that holds the service role key, so it bypasses RLS: scope every query by the caller's `householdId`/`userId` yourself.
- Credentials are encrypted with `encryption.ts` (AES-256-GCM, `ENCRYPTION_KEY`) before they're stored. Never log credentials, OTPs, tokens or national IDs; log provider names and counts only.
- Bank-specific parsing lives in `bank-rules.ts` (Hebrew regexes, tested in `tests/scraper/bankRules.test.ts`). Add a case to that test with every real description you handle.
- `israeli-bank-scrapers` upgrades: read its changelog and `engines` (6.12+ needs Node ≥ 22.22.2), run `npx tsc --noEmit`, and update the Dockerfile's Node version and CI's together.
- The Dockerfile pins Debian bookworm because its Chromium dependency names (`libasound2`, `libappindicator3-1`) differ on trixie. Production uses the image's system Chromium; Puppeteer's own download is skipped.
- CORS: the allow-list defaults live in `server.ts` (haooga.com, www, localhost:5173); production can override them with `ALLOWED_ORIGINS`.
- `GET /health` must keep returning `{"ok":true,"service":"ooga-scraper"}`: CI's smoke test and `/deploy-scraper` both rely on it.
- Shipping: merge to `master`, then the user runs `/deploy-scraper` from their Mac. Nothing deploys the scraper automatically.
