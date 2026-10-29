---
paths:
  - "supabase/**"
  - "scripts/**/*.sql"
---

# Database (Supabase Postgres)

- Migrations are applied by hand in the Supabase SQL editor, in number order. The repo can't tell what production has applied, so treat every numbered file as possibly applied: fix forward with a new migration, never edit an old one.
- Start from `.claude/skills/new-migration/template.sql`. Match 036–039: a header block that says what changes and why, `-- ── section ──` dividers, `COMMENT ON` for new columns, and idempotent statements.
- Households scope everything. Policies call `user_is_in_household(household_id)` or `user_is_household_owner_or_admin(household_id)`; a policy on `household_members` that queries `household_members` directly recurses (see `docs/learning/RLS_RECURSION_AND_SECURITY_DEFINER.md`).
- SECURITY DEFINER functions: `SET search_path = public`, verify the caller's membership inside the function, then `REVOKE EXECUTE … FROM PUBLIC, anon` and `GRANT EXECUTE … TO authenticated`. Since 039 new functions aren't anon-executable by default; keep the explicit revoke anyway.
- Secret columns are hidden with column-level grants: `bank_connections.credentials_encrypted` is readable only by the service role (036). Re-check those grants whenever you add a column to that table.
- Destructive steps (DROP, DELETE, type changes, NOT NULL on existing data) need the user's explicit OK, a note on backing up first, and a check query the user can run before and after.
- Keep the app working on both sides of the deploy: new columns nullable or defaulted, and code that tolerates the migration not being applied yet (the `mark_connection_synced` fallback in `calDirectService.ts` is the model).
- Name RPCs in snake_case and call them through a service in `src/services/`, never from a component.
- When you're done, have `db-reviewer` review the migration, then tell the user exactly which file to run in the SQL editor and what to check afterwards.
