# Ooga — Copilot instructions

The project's instructions for every coding agent live in [`AGENTS.md`](../AGENTS.md) at the repo root. Read it before making changes: it covers the stack, commands, architecture, screen map, conventions, database and security rules, and the working agreement.

The rules that matter most, in case `AGENTS.md` isn't loaded:

- Tailwind CSS stays on v3.4 with the JS config. Do not upgrade to v4. Dynamic class names must match a `safelist` pattern in `tailwind.config.js`.
- Before non-trivial changes (several files, behaviour, schema, dependencies, CI or deploy config), explain the change per file and wait for approval. Afterwards, summarise what changed in each file.
- Schema changes are new numbered files in `supabase/migrations/`; never edit an existing migration. RLS on every table.
- Never read or print `.env.local`, `.env.test.local`, `scraper/.env.scraper` or `.env.relay`.
- Run `npm run typecheck && npm run test:run` before calling a change done.
