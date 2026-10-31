-- ============================================================================
-- IMPORT: JOIN "PAID WITH" ENTRIES IN THE SAME STEP, RE-CHECK DELETIONS, TIDY UP
-- ============================================================================
-- Why: with 041, Import (commit_import) moved the ticked rows into transactions,
-- and the browser then joined some of them to the manual "Paid with" entries
-- they matched. If the tab closed in between, those rows stayed next to their
-- entries, counted twice, with nothing to bring the person back. Also, a row a
-- household member deleted after it was fetched still came in on Import, and an
-- abandoned holding area was never cleared.
-- What changes:
--   * commit_import: a selected row may name the entry it joins ("entry_id"); the
--     join (merge_bank_transaction, 038) runs right after the row is inserted, in
--     the same transaction. A join that fails leaves the row imported on its own
--     (outcome imported_not_joined) instead of undoing the import; a join that
--     works is imported_joined.
--   * commit_import: a row that wasn't marked "deleted earlier" when it was fetched
--     but has been deleted by a household member since is skipped (deleted_meanwhile).
--     A row the person ticked to bring back (tombstone_key set) comes in as before.
--   * cleanup_stale_import_holding(): empties the caller's own holding areas left
--     unreviewed for more than 14 days (only ones that still hold rows, in the
--     caller's current household) and marks those imports cancelled. Import runs
--     it first and carries on whatever it does; the rows come back on the next
--     fetch anyway ("not now").
-- Requires 038 and 041.
-- Deploy order: Safe to run before or after deploying any app version. The app
-- sends entry_id and reads the new outcomes when they're there, and joins rows
-- itself, as before, when they aren't.

-- ── Tidy up: the caller's own holding areas left unreviewed for 14 days ──────

CREATE OR REPLACE FUNCTION cleanup_stale_import_holding()
RETURNS integer -- imports cancelled
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_ids uuid[];
BEGIN
  -- Only holding areas that still hold rows: older imports (before 041, or through the import
  -- service) never set reviewed_at and must be left alone. Only the caller's current household,
  -- since the update policy checks it. SKIP LOCKED: an import someone is finishing right now is theirs.
  SELECT array_agg(s.id) INTO v_ids FROM (
    SELECT s.id FROM bank_import_sessions s
    WHERE s.user_id = auth.uid()
      AND s.reviewed_at IS NULL
      AND s.started_at < now() - interval '14 days'
      AND user_is_in_household(s.household_id)
      AND EXISTS (SELECT 1 FROM import_staged_rows r WHERE r.session_id = s.id)
    FOR UPDATE OF s SKIP LOCKED
  ) s;
  IF v_ids IS NULL THEN
    RETURN 0;
  END IF;

  DELETE FROM import_staged_rows WHERE session_id = ANY (v_ids);
  UPDATE bank_import_sessions
  SET status = 'cancelled', reviewed_at = now(), updated_at = now()
  WHERE id = ANY (v_ids) AND reviewed_at IS NULL;
  RETURN array_length(v_ids, 1);
END;
$$;

COMMENT ON FUNCTION cleanup_stale_import_holding() IS
  'Cancels the caller''s own imports left unreviewed for more than 14 days and empties their holding areas.';

REVOKE EXECUTE ON FUNCTION cleanup_stale_import_holding() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION cleanup_stale_import_holding() TO authenticated;

-- ── Import, now joining entries and re-checking deletions ───────────────────
-- p_selected: [{ "id": <staged row id>, "category": <name>?, "category_id": <uuid>?, "entry_id": <uuid>? }, …]
-- Outcomes: imported | imported_joined | imported_not_joined
--         | already_imported (another member's import got there first)
--         | deleted_meanwhile (a member deleted it after it was fetched)
--         | missing (not in this session)

CREATE OR REPLACE FUNCTION commit_import(p_session_id uuid, p_selected jsonb)
RETURNS TABLE (staged_id uuid, transaction_id uuid, outcome text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_session  bank_import_sessions;
  v_item     jsonb;
  v_staged   import_staged_rows;
  v_row      jsonb;
  v_new_id   uuid;
  v_entry_id uuid;
  v_count    integer := 0;
BEGIN
  -- RLS shows only the caller's own sessions; the lock stops two tabs finishing the same import
  SELECT * INTO v_session FROM bank_import_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'import session not found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT user_is_in_household(v_session.household_id) THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  IF v_session.reviewed_at IS NOT NULL THEN
    RAISE EXCEPTION 'import session already finished' USING ERRCODE = 'P0001';
  END IF;
  -- Rows may still be arriving from the bank: finish only a fetched import
  IF v_session.status IN ('pending', 'logging_in', 'awaiting_otp', 'importing') THEN
    RAISE EXCEPTION 'import still fetching' USING ERRCODE = 'P0001';
  END IF;

  -- The person's other holding areas left for two weeks: they'd only come back on a fetch.
  -- Tidying up never stands in the way of this Import.
  IF v_session.started_at >= now() - interval '14 days' THEN
    BEGIN
      PERFORM cleanup_stale_import_holding();
    EXCEPTION WHEN others THEN
      NULL;
    END;
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_selected, '[]'::jsonb))
  LOOP
    SELECT * INTO v_staged FROM import_staged_rows
    WHERE id = (v_item->>'id')::uuid AND session_id = p_session_id AND household_id = v_session.household_id;
    IF NOT FOUND THEN
      staged_id := (v_item->>'id')::uuid; transaction_id := NULL; outcome := 'missing';
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- Deleted by a member after this was fetched (rows ticked to be brought back carry tombstone_key)
    IF v_staged.tombstone_key IS NULL AND EXISTS (
      SELECT 1 FROM import_tombstones t
      WHERE t.household_id = v_session.household_id
        AND t.import_key IN (v_staged.import_key, v_staged.payload->>'_legacyHash')
    ) THEN
      staged_id := v_staged.id; transaction_id := NULL; outcome := 'deleted_meanwhile';
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- The bank's data, the person's category choice, and the fields this import decides
    v_row := v_staged.payload
      || jsonb_strip_nulls(jsonb_build_object('category', v_item->'category', 'category_id', v_item->'category_id'))
      || jsonb_build_object(
           'user_id', auth.uid(),
           'household_id', v_session.household_id,
           'source', 'bank_import',
           'import_session_id', p_session_id,
           'bank_connection_id', COALESCE(v_session.bank_connection_id::text, v_staged.payload->>'bank_connection_id'));

    v_new_id := NULL;
    -- No conflict target: either unique import key (dedupe_hash, external_id) means it's already there
    INSERT INTO transactions (
      user_id, household_id, date, description, amount, category, category_id, type, source,
      external_id, dedupe_hash, bank_account_number, bank_card_last4, bank_connection_id, import_session_id,
      processed_date, original_amount, original_currency, installment_number, installment_total, memo, status)
    SELECT
      r.user_id, r.household_id, r.date, r.description, r.amount, r.category, r.category_id, r.type, r.source,
      r.external_id, r.dedupe_hash, r.bank_account_number, r.bank_card_last4, r.bank_connection_id, r.import_session_id,
      r.processed_date, r.original_amount, r.original_currency, r.installment_number, r.installment_total, r.memo,
      COALESCE(r.status, 'completed')
    FROM jsonb_populate_record(NULL::transactions, v_row) AS r
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_new_id;

    -- Bringing a row back ends its "deleted" mark either way
    IF v_staged.tombstone_key IS NOT NULL THEN
      DELETE FROM import_tombstones
      WHERE household_id = v_session.household_id
        AND import_key IN (v_staged.tombstone_key, v_staged.import_key);
    END IF;

    staged_id := v_staged.id;
    transaction_id := v_new_id;
    IF v_new_id IS NULL THEN
      outcome := 'already_imported';
    ELSE
      v_count := v_count + 1;
      outcome := 'imported';
      IF NULLIF(v_item->>'entry_id', '') IS NOT NULL THEN
        -- Join it to the manual entry it matched (038 checks the household, the types and that the
        -- entry is still manual). Its own block: a failed join, or a malformed id, undoes only
        -- itself, not the import.
        BEGIN
          v_entry_id := (v_item->>'entry_id')::uuid;
          PERFORM merge_bank_transaction(v_entry_id, v_new_id);
          -- The merge moved the bank row into the entry: the entry is the transaction now
          transaction_id := v_entry_id;
          outcome := 'imported_joined';
        EXCEPTION WHEN others THEN
          outcome := 'imported_not_joined';
        END;
      END IF;
    END IF;
    RETURN NEXT;
  END LOOP;

  -- Finish the import: unticked rows aren't imported ("not now"), and the holding area empties
  UPDATE bank_import_sessions
  SET reviewed_at = now(), status = 'complete', transactions_imported = v_count,
      completed_at = COALESCE(completed_at, now()), updated_at = now()
  WHERE id = p_session_id;
  -- Only rows that were there when this started (now() is the transaction's start time)
  DELETE FROM import_staged_rows WHERE session_id = p_session_id AND created_at <= now();
END;
$$;

COMMENT ON FUNCTION commit_import(uuid, jsonb) IS
  'Imports the ticked staged rows of the caller''s own import session in one transaction, joining them to the "Paid with" entries named, and finishes the session.';

REVOKE EXECUTE ON FUNCTION commit_import(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION commit_import(uuid, jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- ── Self-check ──────────────────────────────────────────────────────────────

DO $$
BEGIN
  PERFORM 'public.import_staged_rows'::regclass;                              -- 041 must be applied
  PERFORM 'public.merge_bank_transaction(uuid, uuid)'::regprocedure;           -- 038 must be applied
  IF (SELECT prosecdef FROM pg_proc WHERE oid = 'public.commit_import(uuid, jsonb)'::regprocedure)
     OR (SELECT prosecdef FROM pg_proc WHERE oid = 'public.cleanup_stale_import_holding()'::regprocedure) THEN
    RAISE EXCEPTION 'commit_import and cleanup_stale_import_holding must run with the caller''s permissions (SECURITY INVOKER)';
  END IF;
  IF has_function_privilege('anon', 'public.commit_import(uuid, jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.cleanup_stale_import_holding()', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.commit_import(uuid, jsonb)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.cleanup_stale_import_holding()', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.merge_bank_transaction(uuid, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'commit_import / cleanup_stale_import_holding / merge_bank_transaction: unexpected EXECUTE privileges';
  END IF;
  RAISE NOTICE 'Migration 042 OK: commit_import joins entries and re-checks deletions; stale holding areas are tidied';
END $$;
