-- ============================================================================
-- UNDOING A MERGE ONLY RESTORES ROWS INTO THE MERGED ENTRY'S OWN HOUSEHOLD
-- ============================================================================
-- Why: unmerge_bank_transaction (038) runs with elevated rights and puts back the
-- manual entry and the bank row exactly as they were, from the entry's
-- merge_snapshot. That snapshot is an ordinary column any household member can
-- update, so a member could write a snapshot naming another household, another
-- user or an existing row's id, and the undo would insert it, bypassing the
-- row-level security that applies everywhere else.
-- What changes: unmerge_bank_transaction, same signature and the same exact undo
-- for snapshots written by merge_bank_transaction. What it restores is pinned:
--   * the entry keeps the merged row's id; both rows go back into the merged
--     row's household; the entry is 'manual' and the bank row 'bank_import';
--   * each row's user_id is kept only if that person belongs to the household,
--     otherwise it's the caller;
--   * the bank row must have an id that no transaction uses yet;
--   * neither restored row carries a merge snapshot of its own.
-- Not in this migration: stopping the browser from writing merge_snapshot at all.
-- The import still updates it (a merged entry's billed charge), so that's a
-- separate, later step.
-- Deploy order: Safe to run before or after deploying any app version.

CREATE OR REPLACE FUNCTION unmerge_bank_transaction(p_entry_id uuid)
RETURNS uuid -- the restored bank row's id
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  merged transactions;
  entry  transactions;
  bank   transactions;
BEGIN
  SELECT * INTO merged FROM transactions WHERE id = p_entry_id FOR UPDATE;

  IF merged.id IS NULL OR merged.merge_snapshot IS NULL THEN
    RAISE EXCEPTION 'Nothing to undo';
  END IF;
  IF NOT user_is_in_household(merged.household_id) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  entry := jsonb_populate_record(NULL::transactions, merged.merge_snapshot->'entry');
  bank  := jsonb_populate_record(NULL::transactions, merged.merge_snapshot->'bank_row');

  -- The bank row comes back under its own id, which nothing may be using
  IF bank.id IS NULL OR bank.id = merged.id OR EXISTS (SELECT 1 FROM transactions WHERE id = bank.id) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  -- Whatever the snapshot says, both rows return to the merged entry's place
  entry.id           := merged.id;
  entry.household_id := merged.household_id;
  bank.household_id  := merged.household_id;
  entry.source       := 'manual';
  bank.source        := 'bank_import';
  entry.merge_snapshot := NULL;
  bank.merge_snapshot  := NULL;
  IF entry.user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM household_members WHERE household_id = merged.household_id AND user_id = entry.user_id
  ) THEN
    entry.user_id := auth.uid();
  END IF;
  IF bank.user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM household_members WHERE household_id = merged.household_id AND user_id = bank.user_id
  ) THEN
    bank.user_id := auth.uid();
  END IF;

  DELETE FROM transactions WHERE id = merged.id;
  INSERT INTO transactions SELECT entry.*;
  INSERT INTO transactions SELECT bank.*;
  RETURN bank.id;
END;
$$;

COMMENT ON FUNCTION unmerge_bank_transaction(uuid) IS
  'Undoes a merge: restores the manual entry and the bank row from merge_snapshot, pinned to the merged entry''s household.';

REVOKE EXECUTE ON FUNCTION unmerge_bank_transaction(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION unmerge_bank_transaction(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- ── Self-check ──────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_config text[];
BEGIN
  SELECT proconfig INTO v_config FROM pg_proc WHERE oid = 'public.unmerge_bank_transaction(uuid)'::regprocedure;
  IF NOT 'search_path=public' = ANY (COALESCE(v_config, '{}')) THEN
    RAISE EXCEPTION 'unmerge_bank_transaction must SET search_path = public';
  END IF;
  IF has_function_privilege('anon', 'public.unmerge_bank_transaction(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.unmerge_bank_transaction(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'unmerge_bank_transaction: unexpected EXECUTE privileges';
  END IF;
  RAISE NOTICE 'Migration 043 OK: undoing a merge restores rows only into the merged entry''s household';
END $$;
