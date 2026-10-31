-- ============================================================================
-- IMPORT HOLDING AREA: FETCHED BANK ROWS WAIT FOR "IMPORT"
-- ============================================================================
-- Why: a bank import used to write its rows straight into transactions, so they
-- counted in the budget before anyone reviewed them, an abandoned review left
-- them there undecided, and a row someone had deleted was hidden from every
-- later import with no way back.
-- What changes:
--   * import_staged_rows: the rows an import fetched, held per import session
--     until the person who fetched them presses Import or cancels. Each row
--     keeps the transaction it would become (`payload`) and, when a household member
--     deleted that bank row before, the tombstone it matched (`tombstone_key`),
--     so the review can offer it again, unticked.
--   * bank_import_sessions: which connection it fetched (bank_connection_id),
--     when its review was finished (reviewed_at), and a 'cancelled' status.
--   * commit_import(session, selected rows): in one transaction, moves the
--     ticked rows into transactions, removes their tombstones, finishes the
--     session and empties its holding area. Unticked rows are simply not
--     imported ("not now"); the next fetch offers them again. Runs with the
--     caller's own permissions (SECURITY INVOKER), so RLS applies as usual.
-- Requires 036 (import_tombstones and the household-wide import keys).
-- Deploy order: Safe to run before or after deploying any app version. Nothing
-- existing changes shape; the app only uses the holding area once its code
-- ships, and until then imports keep writing to transactions as before.

-- ── Import sessions: connection, review time, cancelled ─────────────────────

ALTER TABLE bank_import_sessions
  ADD COLUMN IF NOT EXISTS bank_connection_id uuid REFERENCES bank_connections(id) ON DELETE SET NULL;
COMMENT ON COLUMN bank_import_sessions.bank_connection_id IS 'The connected account this import fetched from.';

ALTER TABLE bank_import_sessions
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
COMMENT ON COLUMN bank_import_sessions.reviewed_at IS
  'When the review was finished (Import or Cancel import). Null on a fetched session means its rows still wait in import_staged_rows.';

-- 'cancelled' joins the statuses. 024 declared the check inline, so its name was generated:
-- replace whichever check is on the status column rather than trusting the name. This only widens it.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.bank_import_sessions'::regclass AND contype = 'c'
      AND conkey = ARRAY[(SELECT attnum FROM pg_attribute
                          WHERE attrelid = 'public.bank_import_sessions'::regclass AND attname = 'status')]::int2[]
      AND conname <> 'bank_import_sessions_status_allowed'
  LOOP
    EXECUTE format('ALTER TABLE bank_import_sessions DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE bank_import_sessions DROP CONSTRAINT IF EXISTS bank_import_sessions_status_allowed;
ALTER TABLE bank_import_sessions ADD CONSTRAINT bank_import_sessions_status_allowed
  CHECK (status IN ('pending', 'logging_in', 'awaiting_otp', 'importing', 'complete', 'error', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_bank_import_sessions_connection
  ON bank_import_sessions (bank_connection_id) WHERE bank_connection_id IS NOT NULL;

-- A session's household (and so where its rows import to) must be one the person belongs to.
-- 031 only checked the owner; the scraper writes sessions with the service role and isn't affected.
DROP POLICY IF EXISTS "Users can insert their own import sessions" ON bank_import_sessions;
CREATE POLICY "Users can insert their own import sessions"
  ON bank_import_sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND user_is_in_household(household_id));

DROP POLICY IF EXISTS "Users can update their own import sessions" ON bank_import_sessions;
CREATE POLICY "Users can update their own import sessions"
  ON bank_import_sessions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND user_is_in_household(household_id));

CREATE INDEX IF NOT EXISTS idx_bank_import_sessions_unreviewed
  ON bank_import_sessions (user_id, started_at DESC)
  WHERE reviewed_at IS NULL;

-- ── The holding area ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS import_staged_rows (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id  uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  session_id    uuid NOT NULL REFERENCES bank_import_sessions(id) ON DELETE CASCADE,
  import_key    text NOT NULL,   -- the row's dedupe_hash (browser imports) or external_id (server imports)
  tombstone_key text,            -- the import_tombstones key it matched, when it was deleted before
  payload       jsonb NOT NULL,  -- the transaction it becomes; commit_import keeps only the bank columns
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, import_key)
);

COMMENT ON TABLE import_staged_rows IS
  'Bank rows an import fetched, waiting for the person who fetched them to Import or cancel. Never counted in the budget.';
COMMENT ON COLUMN import_staged_rows.tombstone_key IS
  'Set when a household member deleted this bank row before: the review shows it unticked, and importing it removes the tombstone.';

CREATE INDEX IF NOT EXISTS idx_import_staged_rows_household ON import_staged_rows (household_id);
CREATE INDEX IF NOT EXISTS idx_import_staged_rows_created ON import_staged_rows (created_at);

ALTER TABLE import_staged_rows ENABLE ROW LEVEL SECURITY;

-- Only the person who fetched an import sees and changes its holding area, within their household.
-- (bank_import_sessions' own RLS shows each person only their sessions.)
DROP POLICY IF EXISTS "Importers can view their staged rows" ON import_staged_rows;
CREATE POLICY "Importers can view their staged rows"
  ON import_staged_rows FOR SELECT TO authenticated
  USING (
    user_is_in_household(household_id)
    AND EXISTS (SELECT 1 FROM bank_import_sessions s
                WHERE s.id = import_staged_rows.session_id AND s.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Importers can stage rows" ON import_staged_rows;
CREATE POLICY "Importers can stage rows"
  ON import_staged_rows FOR INSERT TO authenticated
  WITH CHECK (
    user_is_in_household(household_id)
    AND EXISTS (SELECT 1 FROM bank_import_sessions s
                WHERE s.id = import_staged_rows.session_id AND s.user_id = auth.uid()
                  AND s.household_id = import_staged_rows.household_id)
  );

DROP POLICY IF EXISTS "Importers can update their staged rows" ON import_staged_rows;
CREATE POLICY "Importers can update their staged rows"
  ON import_staged_rows FOR UPDATE TO authenticated
  USING (
    user_is_in_household(household_id)
    AND EXISTS (SELECT 1 FROM bank_import_sessions s
                WHERE s.id = import_staged_rows.session_id AND s.user_id = auth.uid())
  )
  WITH CHECK (
    user_is_in_household(household_id)
    AND EXISTS (SELECT 1 FROM bank_import_sessions s
                WHERE s.id = import_staged_rows.session_id AND s.user_id = auth.uid()
                  AND s.household_id = import_staged_rows.household_id)
  );

DROP POLICY IF EXISTS "Importers can discard their staged rows" ON import_staged_rows;
CREATE POLICY "Importers can discard their staged rows"
  ON import_staged_rows FOR DELETE TO authenticated
  USING (
    user_is_in_household(household_id)
    AND EXISTS (SELECT 1 FROM bank_import_sessions s
                WHERE s.id = import_staged_rows.session_id AND s.user_id = auth.uid())
  );

-- ── Import: move the ticked rows into transactions, in one step ─────────────
-- p_selected: [{ "id": <staged row id>, "category": <name>?, "category_id": <uuid>? }, …]
-- Returns one line per selected row: its new transaction id and an outcome:
--   imported | already_imported (another member's import got there first) | missing (not in this session)

CREATE OR REPLACE FUNCTION commit_import(p_session_id uuid, p_selected jsonb)
RETURNS TABLE (staged_id uuid, transaction_id uuid, outcome text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_session bank_import_sessions;
  v_item    jsonb;
  v_staged  import_staged_rows;
  v_row     jsonb;
  v_new_id  uuid;
  v_count   integer := 0;
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

  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_selected, '[]'::jsonb))
  LOOP
    SELECT * INTO v_staged FROM import_staged_rows
    WHERE id = (v_item->>'id')::uuid AND session_id = p_session_id AND household_id = v_session.household_id;
    IF NOT FOUND THEN
      staged_id := (v_item->>'id')::uuid; transaction_id := NULL; outcome := 'missing';
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
    outcome := CASE WHEN v_new_id IS NULL THEN 'already_imported' ELSE 'imported' END;
    IF v_new_id IS NOT NULL THEN v_count := v_count + 1; END IF;
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
  'Imports the ticked staged rows of the caller''s own import session in one transaction and finishes the session.';

REVOKE EXECUTE ON FUNCTION commit_import(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION commit_import(uuid, jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- ── Self-check ──────────────────────────────────────────────────────────────

DO $$
BEGIN
  PERFORM 'public.import_tombstones'::regclass;  -- 036 must be applied
  IF (SELECT count(*) FROM pg_constraint WHERE conrelid = 'public.bank_import_sessions'::regclass AND contype = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%status%') <> 1 THEN
    RAISE EXCEPTION 'bank_import_sessions: expected exactly one status check';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid = 'public.import_staged_rows'::regclass AND relrowsecurity) THEN
    RAISE EXCEPTION 'import_staged_rows: row level security is off';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE tablename = 'import_staged_rows') <> 4 THEN
    RAISE EXCEPTION 'import_staged_rows: expected 4 policies';
  END IF;
  IF has_function_privilege('anon', 'public.commit_import(uuid, jsonb)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.commit_import(uuid, jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'commit_import: unexpected EXECUTE privileges';
  END IF;
  IF (SELECT prosecdef FROM pg_proc WHERE oid = 'public.commit_import(uuid, jsonb)'::regprocedure) THEN
    RAISE EXCEPTION 'commit_import must run with the caller''s permissions (SECURITY INVOKER)';
  END IF;
  RAISE NOTICE 'Migration 041 OK: holding area, its policies and commit_import are in place';
END $$;
