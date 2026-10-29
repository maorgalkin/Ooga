# docs-expert memory

## Doc map (2026-10-29)

| Topic | Canonical doc |
|---|---|
| Agent instructions (all tools) | `AGENTS.md` (Claude imports it from `CLAUDE.md`; `.github/copilot-instructions.md` points to it) |
| Overview, setup, scripts | `README.md` |
| Supabase setup | `docs/SUPABASE_BRINGUP.md` |
| Bank import, scraper | `docs/BANK_IMPORT.md`, `docs/CAL_INTEGRATION.md` |
| Scraper server (Vultr, Tel Aviv) | `docs/SCRAPER_DEPLOY.md` (was `HETZNER_DEPLOY.md`) |
| Web hosting | `docs/CLOUDFLARE_SETUP.md` |
| Budget model | `docs/BUDGET_ARCHITECTURE.md` |
| Retired features | `docs/DEPRECATED_FEATURES.md` |
| Tests | `docs/TEST_DOCUMENTATION.md`, `tests/integration/README.md` |
| Learning notes | `docs/learning/` and `learning/` (two folders) |

## Drift backlog (found 2026-10-29, not yet fixed)

1. `README.md` "How to Use" describes retired UI: a Budget Settings modal with Visual/JSON tabs, and "two main views" on the dashboard (there are four tabs). Rewrite from the screen map in `AGENTS.md`.
2. `docs/CLOUDFLARE_SETUP.md` says Cloudflare **Pages**, but commit 2988b6e changed the SPA fallback for "Cloudflare **Workers** Assets", and the unmerged bot branch `cloudflare/workers-autoconfig` adds a `wrangler.jsonc`. Ask the user which product serves haooga.com, then fix. Its "Step 5" (apply migrations 029–032) is a one-off from May 2026.
3. `docs/SUPABASE_BRINGUP.md` (~1,100 lines): the deploy section (~lines 820–845) still describes Vercel/Netlify.
4. `docs/TEST_DOCUMENTATION.md`: the title line is duplicated; 1,676 lines, last touched March 2026. Verify against `tests/` before trusting it.
5. Two learning folders: `learning/` and `docs/learning/`. Merge into `docs/learning/`.
6. Root one-off guides from Nov 2025: `FIX_HOUSEHOLD_ERROR.md`, `QUICKSTART_FIX.md`, and `test-autoload.html`. Archive or delete.
7. Shipped plans and status reports, to archive or fold into canonical docs: `PHASE1_MULTI_USER_PLAN.md`, `CATEGORY_MANAGEMENT_RESTRUCTURE.md`, `HOUSEHOLD_IMPLEMENTATION_SUMMARY.md`, `INSTALLMENTS_FEATURE.md` ("Implementation Complete ✅"), `INSTALLMENTS_QUICK_START.md`, `MONTHLY_BUDGET_HISTORY_ANALYSIS.md`, `MONTHLY_BUDGET_HISTORY_GUIDE.md`, `MIGRATION_009_AUTO_HOUSEHOLD.md`, `MAGNIFIER_LEARNING_SUMMARY.md`, `tests/integration/AUDIT_REPORT.md`, `tests/integration/TEST_RESULTS.md`.
8. `docs/COMPLETE_FEATURE_SUMMARY.md`: check it covers bank import, households, installments, currency conversion and projected months.
9. Comment hygiene: comments that cite plans ("Part of Category Management Restructure (Phase 4)") in `src/hooks/` and `src/components/categories/`.
10. `src/lib/supabase.ts`: the hand-written `Database` interface is stale (old `transactions` columns). Removing it or generating types is an implementer decision; its comment should at least say it's not maintained.

## Decisions

- 2026-10-29: Hetzner guide replaced by `docs/SCRAPER_DEPLOY.md` for the Vultr server; README facts updated (Node 22, Tailwind 3.4, hosting, CI, test commands); `DEPRECATED_FEATURES.md` gained the Dev Tools page entry and the `lib/` removal.
