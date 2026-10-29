# cicd-operator memory

## Baseline (2026-10-29, CI bootstrap)

- Web: `npm ci` clean, typecheck 0 errors, 277 unit tests passing (25 files), `npm run build` passes. Main JS chunk ~1.26 MB (Vite warns above 500 kB).
- ESLint: 124 errors (82 `no-explicit-any`, 30 `no-unused-vars`, 7 `no-case-declarations`, 3 `prefer-const`, 2 `react-refresh/only-export-components`), 13 warnings. `ESLINT_MAX_ERRORS` = 124 in `ci.yml`.
- Scraper: `npm ci` (with `PUPPETEER_SKIP_DOWNLOAD`), `tsc --noEmit` and build pass on Node 22.
- The Docker image change (node:20-slim → node:22-bookworm-slim) was not built locally: container registries were unreachable from that session. The first `scraper-image.yml` run on the bootstrap PR is its real test.

## History

- `npm ci` used to fail: the lockfile lacked `@testing-library/dom` (a peer of `@testing-library/react`), most likely because it was generated with `legacy-peer-deps`. Fixed by making it an explicit dev dependency.
- `npm run build` used to skip type-checking, and 33 type errors had shipped, including a crash in `PersonalBudgetEditor` (undefined `showRoundedAmounts`). The build now runs `npm run typecheck` first, so Cloudflare won't deploy a build with type errors either.
- Default `vitest run` used to pick up the integration suites; they're excluded in `vitest.config.ts` now, and unit tests point Supabase at a closed port (`http://127.0.0.1:9`).
- Integration tests used to fall back silently to `.env.local` (production) when no test project was configured. `tests/integration/globalSetup.ts` now exits unless `VITE_SUPABASE_TEST_URL` is set and differs from `VITE_SUPABASE_URL`, or `ALLOW_PRODUCTION_INTEGRATION_TESTS=1`.

## Open follow-ups

- Branch protection on `master`: require `Web app`, `Lint (ratchet)` and `Scraper` (not `Build and smoke-test`, which is path-filtered). Needs the user in GitHub settings.
- Dependency updates (Dependabot or Renovate) aren't configured.
- `tests/` isn't type-checked (`tsconfig.app.json` includes only `src`).
- The `AddTransaction` stress tests let the component call `listConnections()`, which fails fast against the closed port; mock `bankImportService` there.
- Integration tests don't run in CI: they need a separate Supabase test project and secrets, and must not run on fork PRs.
- Which Node version Cloudflare's build uses is unknown; check its build log before adding `.nvmrc` or `engines`.
