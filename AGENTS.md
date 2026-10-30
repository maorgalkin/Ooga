# Ooga — instructions for coding agents

Ooga is a family finance tracker (haooga.com): budgets, transactions, household sharing and bank imports from Israeli banks. This file is the shared source of truth for every coding agent (Claude Code imports it from `CLAUDE.md`; Copilot reads it directly). Keep it short and true; detailed procedures live in `.claude/skills/`, area rules in `.claude/rules/`.

## The three parts

| Part | Path | Stack | Runs on / deploys |
|---|---|---|---|
| Web app | `src/` | React 19, TypeScript 5.8 (strict), Vite 7, Tailwind 3.4, TanStack Query 5, React Router 6, Recharts 3, framer-motion, lucide-react, i18next | Cloudflare builds `npm run build` on every push to `master` (auto-deploy) |
| Bank scraper | `scraper/` | Node 22, Express 4, israeli-bank-scrapers (Puppeteer + system Chromium), supabase-js with the service role | Docker on a Vultr server in Tel Aviv behind nginx at `https://api.haooga.com`; deployed by hand (`/deploy-scraper`, see `docs/SCRAPER_DEPLOY.md`) |
| Database | `supabase/migrations/` | Supabase Postgres + Auth, RLS on every table | Migrations are applied by hand in the Supabase SQL editor |

## Commands

```bash
npm run dev               # Vite on http://localhost:5173 (needs .env.local)
npm run typecheck         # tsc -b
npm run test:run          # unit tests (Vitest + RTL, jsdom); never touch a real Supabase project
npm run lint              # ESLint; ~124 pre-existing errors, CI fails only if the count goes up
npm run build             # typecheck + vite build + 404.html copy (exactly what Cloudflare runs)
npm run test:integration  # integration suites against a test Supabase project (.env.test.local)

cd scraper && npx tsc --noEmit && npm run build   # scraper checks
docker compose up --build                          # scraper locally on :3001
```

Before calling a change done, run `npm run typecheck && npm run test:run` (plus the scraper checks if you touched `scraper/`). CI runs the same on every PR: `.github/workflows/ci.yml` (web, lint ratchet, scraper) and `scraper-image.yml` (Docker build + smoke test when `scraper/` changes).

## How the web app is put together

- **Supabase client:** `src/lib/supabase.ts` (anon key; RLS does the access control). The service role key never appears in `src/`.
- **Data access:** `src/services/*` (function modules or static classes such as `PersonalBudgetService`). Components call services or hooks rather than `supabase` directly (`LeaveHouseholdModal` is the one exception; don't add more).
- **Server state:** TanStack Query hooks in `src/hooks/` (`useBudgets`, `useCategories`, …) with query-key factories (`categoryKeys`); mutations invalidate the keys they affect. `src/context/FinanceContext.tsx` is the older useState store for transactions and family members; it still drives those screens, but put new server state in React Query hooks.
- **Households:** every user belongs to one household; most tables are scoped by `household_id`, which services resolve from `household_members`. Auth lives in `src/contexts/AuthContext.tsx`.
- **Types:** hand-written in `src/types/` (`budget.ts`, `category.ts`, `index.ts`). The `Database` type in `src/lib/supabase.ts` is partial and stale; don't rely on it.
- **Bank import:** Visa Cal imports run in the browser (`calDirectService.ts`). Other banks (Discount) go through the scraper (`scraperService.ts`, `VITE_SCRAPER_URL`, default `https://api.haooga.com`). `reconcileService.ts` merges bank rows into manual "Paid with" entries.
- **Money and dates:** format money with `formatCurrencyFromSettings` (`src/utils/formatCurrency.ts`, honours `showRoundedAmounts`) and dates with `getUserLocale()` (`src/utils/locale.ts`); both follow the app's language.
- **Languages:** English and Hebrew (react-i18next, text in `src/i18n/locales/`, `useT()` for the reader's Hebrew form of address, right-to-left via `<html dir>`). Language and form of address are saved in the auth user's metadata. See `docs/I18N.md`.

### Screen map (update when you change navigation)

```
App (nav bar: Help → /guide; Add Transaction → AddTransaction modal → BankImportModal; Sign Out)
├── / Dashboard — tabs:
│   ├── Dashboard: tiled layout on desktop, wide on phones; pulsing tiles while loading;
│   │              empty state; projected months
│   ├── Transactions → pages/Transactions (MonthCarousel, filter tree, list, EditTransactionModal)
│   ├── Budget → pages/BudgetManagement
│   │   ├── Overview: BudgetOverviewTab, or PersonalBudgetEditor when no budget exists
│   │   ├── Categories: CategoryList (add, edit, rename, delete, merge)
│   │   └── Settings: BudgetSettings (currency, notifications, LanguageSettings,
│   │                 ConnectedAccountsSettings, HouseholdSettingsModal, BudgetHistory)
│   └── Insights → pages/InsightsPage (date range, budget vs actual, accuracy, pacing, member spend)
├── /login — landing page: hero, sign-in card, feature cards, "How it works" clips
│            (components/info/LandingSections); after sign-in returns to the page that sent
│            you there (router state `from`, checked by utils/returnPath)
├── /register
├── /forgot-password → pages/auth/ForgotPassword (sends the reset email)
├── /reset-password → pages/auth/ResetPassword (the email's link lands here, signed in)
└── Public, signed in or out (PublicLayout's top bar has the language switch):
    ├── /about → pages/info/AboutPage
    └── /guide → pages/info/GuidePage: welcome page with the four parts (Your household,
        Your budget, Day to day, Going deeper);
        /guide/:chapter → household, budget, transactions, update-budget, insights
        (shape in src/content/guide.ts, words in src/i18n/locales/guide.*.json; step links open app tabs via ?tab= / ?subtab=)
```

## Conventions

- TypeScript strict with `noUnusedLocals`/`noUnusedParameters`: delete what you don't use; prefix intentionally unused parameters with `_`. Use `import type` for types.
- Components live in `src/components/<feature>/`, pages in `src/pages/`, tests in `tests/` mirroring `src/`.
- Tailwind 3.4 utilities only (JS config). Do not upgrade to Tailwind 4. Dynamic class names must match a `safelist` pattern in `tailwind.config.js`. Dark mode follows the OS (`dark:` variants).
- Modals fit without scrollbars (flex column, compact spacing); footer: destructive/secondary action left, primary right.
- UI text follows the `microcopy` skill (`.claude/skills/microcopy/`): sentence case, glossary terms, no developer jargon. The UI is in English and Hebrew (`docs/I18N.md`; new text goes in both locale files); bank data arrives in Hebrew, so render it with `dir="auto"`.
- Comments explain *why*, not what. No references to plans, phases or chat sessions. Exported services and hooks get a short JSDoc.
- Don't fix unrelated legacy issues inside a feature change; note them instead.

## Tests

- Unit tests: Vitest + React Testing Library in `tests/` (one legacy file in `src/components/__tests__/`). Mock `src/lib/supabase` per file; `tests/services/personalBudgetService.test.ts` (`mockTables`) and `tests/services/reconcileService.test.ts` show the patterns. `vitest.config.ts` points Supabase at a closed local port, so unit tests can't reach a real project.
- Query by role and label. Tests often assert on visible text, so a copy change means a test change.
- Integration tests (`tests/integration/`) run sequentially against a separate Supabase test project from `.env.test.local`. They refuse to run against the app's own project unless `ALLOW_PRODUCTION_INTEGRATION_TESTS=1` is set; agents never set it.

## Database rules

- Every schema change is a new `supabase/migrations/NNN_snake_case.sql` with the next number; never edit a migration that may already be applied. Use the `new-migration` skill.
- Write migrations so they're safe to re-run (`IF NOT EXISTS`, `CREATE OR REPLACE`) and safe whichever ships first, the app or the migration.
- RLS on every table, scoped through `user_is_in_household()` / `user_is_household_owner_or_admin()` (SECURITY DEFINER helpers that avoid RLS recursion).
- SECURITY DEFINER functions: `SET search_path = public`, check the caller's household inside, `REVOKE EXECUTE … FROM PUBLIC, anon`, `GRANT EXECUTE … TO authenticated` (see migrations 037–039).
- Only `NNN_*.sql` files (three digits) are the schema. The rest of `supabase/migrations/` is historical; don't run or extend it: `UNIFIED_SCHEMA.sql`, `RESTORE_*`, `*diagnostic*`, `FIX_*`, `PHASE1_*`, `test_rpc.sql`, and `20251206_add_installments.sql` (never applied; 033 replaced it).

## Security

- Never read, print or commit real secrets: `.env.local`, `.env.test.local`, `scraper/.env.scraper`, and the legacy `.env.relay`. Only `VITE_*` variables reach the browser, and they are public.
- The service role key and `ENCRYPTION_KEY` exist only in the scraper's environment on the server.
- Never log bank credentials, OTP codes, tokens or national ID numbers.

## Working agreement

- **Non-trivial changes** (several files, behaviour, schema, dependencies, CI or deploy config): first explain the change per file or unit — its effect on the API, UI, app state and tests — and wait for an OK. Copy, doc and typo fixes can go straight in.
- Afterwards, summarise what changed in each file.
- One branch per change (`feat/…`, `fix/…`, `chore/…`), conventional commits (`feat:`, `fix(db):`, `fix(scraper):`), PR into `master`. Merging to `master` deploys the web app.
- When a change alters something a doc describes (the screen map above, `docs/`), update the doc in the same PR.

## Known rough edges

Don't be surprised by, and don't opportunistically "fix", these: the ESLint backlog; `FinanceContext` alongside React Query; `src/utils/currency.ts` duplicating `formatCurrency.ts`; components that still format money with a hard-coded `'en-US'` `Intl.NumberFormat`; `alert()`/`confirm()` used for feedback; the Tailwind Play CDN `<script>` in `index.html`; unreferenced legacy components in `src/components/`. Each is a separate, reviewable change.
