# Guide Screenshots

The Getting started guide (`/guide`) and the "How it works" clips on the landing page are built from real screenshots of a demo household. This page explains how to refresh them.

Everything runs against the **test** Supabase project from `.env.test.local`, never production. The seed script and the server launcher refuse to run if `.env.test.local` points at the same project as `.env.local`; the capture script only drives whatever is serving on :5174, so always start that server with `dev-against-test.mjs`.

## How the pieces fit

| Piece | What it does |
|---|---|
| `scripts/demo/seed-demo-household.ts` | Creates and resets the demo household (steps below) |
| `scripts/demo/dev-against-test.mjs` | Serves the app on `http://localhost:5174` against the test project |
| `scripts/demo/capture-guide.mjs` | Drives Chrome through the app and saves the frames |
| `public/guide/<chapter>/<name>.webp` | The frames, captured at 1.5× |
| `src/content/guide-frames.json` | Size, pointer and highlight box for each frame (percentages of the frame) |
| `src/content/guide.ts` | Guide text; each step picks its frames by key with `clip(alt, 'chapter/name', ...)` |
| `src/components/info/GuideClip.tsx` | Plays a step's frames as a looping walkthrough |

## Prerequisites

- `.env.test.local` with `VITE_SUPABASE_TEST_URL`, `VITE_SUPABASE_TEST_ANON_KEY` and `VITE_SUPABASE_TEST_SERVICE_ROLE_KEY`.
- Google Chrome installed in `/Applications`.
- Scraper dependencies installed (`cd scraper && npm install`): the capture script loads `puppeteer-core` from there.

## Seed steps

Run with `npx tsx scripts/demo/seed-demo-household.ts <step>`.

| Step | Effect |
|---|---|
| `user` | Creates the demo sign-in (Dana Levi) and writes it to `.env.demo.local` (gitignored). Run once. |
| `family` | Adds partner Avi (with a login) and kids Noa and Itai (family members, no login); resets the household name. |
| `fresh` | Empties budgets, transactions and categories; keeps the people. |
| `history` | Adds about 3 months of spending, scaled to each category's monthly limit, plus salaries. Needs the budget to exist. |
| `reset` | Deletes the demo users and their household. |

## Refresh all screenshots

1. Start the app against the test project, in production mode so dev-only controls (dummy data buttons, the DEV badge) stay out of the shots:

   ```bash
   node scripts/demo/dev-against-test.mjs --preview
   ```

   Or use the `demo-test-project-preview` launch config in `.claude/launch.json` (`demo-test-project` runs the dev server instead).

2. In a second terminal, run in this order:

   ```bash
   npx tsx scripts/demo/seed-demo-household.ts fresh
   npx tsx scripts/demo/seed-demo-household.ts family
   node scripts/demo/capture-guide.mjs signed-out
   node scripts/demo/capture-guide.mjs household
   node scripts/demo/capture-guide.mjs budget
   node scripts/demo/capture-guide.mjs transactions
   npx tsx scripts/demo/seed-demo-household.ts history
   node scripts/demo/capture-guide.mjs tour
   ```

   The order matters: `household` and `budget` create the data that later phases show, and `tour` (Update budget and Insights chapters) needs the history.

3. Check the result at `/guide`, then commit `public/guide/` and `src/content/guide-frames.json` together.

To refresh one chapter, rerun only its phase, but read the gotchas first.

## Gotchas

- **Capture phases aren't idempotent.** `household` renames the household and `budget` creates the budget. Run `fresh` and `family` before rerunning them.
- **Keep `captureBeyondViewport: false`** in `capture-guide.mjs`. Capturing beyond the viewport resizes the page mid-shot, so the Dashboard collapses its grid and replays its chart animation.
- **Frame keys are shared.** Renaming a frame in `capture-guide.mjs` means updating the matching `clip(...)` call in `src/content/guide.ts`.
