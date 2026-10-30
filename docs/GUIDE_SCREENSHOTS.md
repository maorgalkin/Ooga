# Guide Screenshots

The Getting started guide (`/guide`) and the "How it works" clips on the landing page are built from real screenshots of a demo household. This page explains how to refresh them.

Everything runs against the **test** Supabase project from `.env.test.local`, never production. The seed script and the server launcher refuse to run if `.env.test.local` points at the same project as `.env.local`; the capture script only drives whatever is serving on :5174, so always start that server with `dev-against-test.mjs`.

## How the pieces fit

| Piece | What it does |
|---|---|
| `scripts/demo/seed-demo-household.ts` | Creates and resets the demo household (steps below) |
| `scripts/demo/dev-against-test.mjs` | Serves the app on `http://localhost:5174` against the test project |
| `scripts/demo/capture-guide.mjs` | Drives Chrome through the app and saves the frames |
| `public/guide/<chapter>/<name>.webp` | The desktop frames, captured at 1.5× in a 1280×800 window |
| `public/guide/mobile/<chapter>/<name>.webp` | The phone frames, captured at 2× in a 390×844 touch window (`--mobile`) |
| `src/content/guide-frames.json`, `guide-frames.mobile.json` | Size, pointer and highlight box for each frame (percentages of the frame); both use the same keys |
| `src/content/guide.ts` | The guide's shape: each step's id, frame keys (`clip: ['chapter/name', ...]`) and link |
| `src/i18n/locales/guide.en.json`, `guide.he.json` | The guide's words in each language, including each clip's alt text |
| `src/components/info/GuideClip.tsx` | Plays a step's frames as a looping walkthrough; below 768px it plays the phone frames, if the step has a phone version of every frame |

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

3. For the phone set, run the same sequence again from `fresh`, adding `--mobile` to every `capture-guide.mjs` call (for example `node scripts/demo/capture-guide.mjs household --mobile`). The phases change the demo data, so the phone run needs its own fresh household.

4. Check the result at `/guide` on desktop and at phone width, then commit `public/guide/` and both manifests together.

To refresh one chapter, rerun only its phase, but read the gotchas first.

The `guide-visuals` agent (`.claude/agents/guide-visuals.md`) follows this procedure for you: after a UI change it works out which frames and guide text went stale, and re-captures them when the drift is substantial.

## Gotchas

- **Capture phases aren't idempotent.** `household` renames the household and `budget` creates the budget. Run `fresh` and `family` before rerunning them.
- **Keep `captureBeyondViewport: false`** in `capture-guide.mjs`. Capturing beyond the viewport resizes the page mid-shot, so the Dashboard collapses its grid and replays its chart animation.
- **Phone frames are cropped.** A phone frame taller than 1.4× its width is cropped around its `target` (or `focus`, which keeps an element in view without the pointer), so a clip fits on a phone screen.
- **Phone selectors differ.** The top bar shows icons only on phones (the `ADD` selector in the script handles Add transaction); check new selectors at 390px too.
- **Frame keys are shared.** Renaming a frame in `capture-guide.mjs` means updating the step's `clip: [...]` in `src/content/guide.ts`.
