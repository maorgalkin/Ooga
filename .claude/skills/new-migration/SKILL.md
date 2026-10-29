---
name: new-migration
description: Write the next numbered Supabase migration for Ooga (supabase/migrations/NNN_snake_case.sql) using the house template — RLS through household helpers, hardened SECURITY DEFINER functions, grants, idempotent DDL — then hand the apply step to the user. Use for any schema, policy, function or grant change.
argument-hint: "[what the migration changes]"
allowed-tools: Bash(ls supabase/migrations*)
---

# New migration

Change requested: $ARGUMENTS

Migrations are applied by hand in the Supabase SQL editor, so a mistake reaches production the moment the user pastes it. Work carefully and keep the user in the loop.

## 1. Understand the current schema

- Find every earlier migration that touches the same tables, functions or policies: `grep -ln "<table_or_function>" supabase/migrations/[0-9][0-9][0-9]_*.sql`. Later files override earlier ones (policies get dropped and recreated), so read them in number order and work out the current state.
- Ignore everything else in the folder (`UNIFIED_SCHEMA.sql`, `RESTORE_*`, `*diagnostic*`, `FIX_*`, `PHASE1_*`, `test_rpc.sql`, and `20251206_add_installments.sql`, which was never applied): it's history, not the schema.
- Find the app code that reads or writes these objects (`grep -rn "<table>" src/services scraper/src`) so the change and the code agree.

## 2. Pick the number

```bash
ls supabase/migrations | grep -E '^[0-9]{3}_' | sort | tail -3
git log --all --name-only --format= -- 'supabase/migrations/' | grep -E '/[0-9]{3}_' | sort -u | tail -5   # numbers taken on other branches
```

Use the next free three-digit number and a short snake_case name: `040_household_invites_expiry.sql`. If another branch already took the number, take the next one; two files with the same number (003, 009) have happened before and are confusing to apply.

## 3. Propose before writing

This is a non-trivial change. Before writing the file, tell the user in a few lines: what changes, which existing data it touches, whether the app must ship first, second or either, and anything destructive. Wait for an OK.

## 4. Write it from the template

Start from [template.sql](template.sql) and delete the sections you don't need. Rules:

- **Header** says what changes and why, in plain words, plus `Safe to run before or after deploying any app version.` when true.
- **Idempotent:** `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, `DROP POLICY IF EXISTS` before `CREATE POLICY`. Re-running the file after a partial failure must be safe.
- **New tables:** `household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE`, `ENABLE ROW LEVEL SECURITY`, and a policy for each operation the app needs, through `user_is_in_household(household_id)` (`user_is_household_owner_or_admin` for owner-only actions). `WITH CHECK` on INSERT and UPDATE.
- **SECURITY DEFINER functions:** `SET search_path = public`, check the caller's household inside the function, then `REVOKE EXECUTE … FROM PUBLIC, anon` and `GRANT EXECUTE … TO authenticated`. Build dynamic SQL only with `format('%I', …)` / `%L`.
- **New columns:** nullable or with a default, so the current app keeps working, plus `COMMENT ON COLUMN`.
- **Secrets:** a column the browser must not read gets column-level grants, like `bank_connections` in 036.
- **Destructive steps** (DROP, DELETE, narrowing a type, NOT NULL on existing rows) go last, behind a check that fails loudly (`RAISE EXCEPTION`) when the data isn't in the expected state.
- **Self-check:** end with a `DO $$ … $$` block or commented `SELECT`s that confirm the result (039 is the model).

## 5. Update the app side

- Types in `src/types/` and the services that use the objects. Keep code working before the migration is applied (feature-detect, or fall back like `mark_connection_synced` in `calDirectService.ts`).
- Unit tests for the service changes (`tests/services/`, `mockTables` pattern).

## 6. Review, then hand off

1. Run the `db-reviewer` subagent on the migration and the related code changes. Fix what it finds.
2. Give the user the apply steps, ready to follow:
   - Supabase dashboard → SQL Editor → New query → paste `supabase/migrations/NNN_name.sql` → Run.
   - The check query to run afterwards and the result to expect.
   - Whether to deploy the app before or after (merging to `master` deploys the web app; the scraper deploys with `/deploy-scraper`).
   - Then check Supabase → Advisors for new security lints.
3. Never claim the migration is applied; only the user can apply it.
