-- ============================================================================
-- SHARED BANK CONNECTIONS + HOUSEHOLD-WIDE IMPORT KEYS + IMPORT TOMBSTONES
-- ============================================================================
-- 1. Every household member can see and import from every connected account.
--    Credentials stay unreadable from the app; only the member who added a
--    connection can change or remove it.
-- 2. Server-side imports (Discount, …) are deduplicated per household, enforced
--    by a unique index (Cal imports already are, via dedupe_hash).
-- 3. Bank-imported rows a member deletes on purpose are remembered, so a later
--    import doesn't bring them back.
--
-- Safe to run before or after deploying the matching app version.

-- ── 1. Shared connections ───────────────────────────────────────────────────

-- Connections added from the browser (Cal fast access) never set household_id
UPDATE bank_connections bc
SET household_id = hm.household_id
FROM (
  SELECT DISTINCT ON (user_id) user_id, household_id
  FROM household_members
  ORDER BY user_id, joined_at NULLS LAST
) hm
WHERE bc.household_id IS NULL AND hm.user_id = bc.user_id;

DROP POLICY IF EXISTS "Users can view their own connections" ON bank_connections;
DROP POLICY IF EXISTS "Household members can view connections" ON bank_connections;
CREATE POLICY "Household members can view connections"
  ON bank_connections FOR SELECT
  USING (auth.uid() = user_id OR user_is_in_household(household_id));

-- New connections belong to the creator's household
DROP POLICY IF EXISTS "Users can insert their own bank connections" ON bank_connections;
CREATE POLICY "Users can insert their own bank connections"
  ON bank_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id AND (household_id IS NULL OR user_is_in_household(household_id)));
-- UPDATE and DELETE stay owner-only (policies from migrations 025/032).

-- The app never needs the encrypted credentials; hide the column from API users.
-- The import service uses the service role, which isn't affected.
REVOKE SELECT ON bank_connections FROM anon, authenticated;
GRANT SELECT (id, user_id, household_id, provider, display_name, last_sync_at, is_active, created_at, metadata)
  ON bank_connections TO authenticated;

-- Any household member can record that an account was just synced
CREATE OR REPLACE FUNCTION mark_connection_synced(p_connection_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE bank_connections
  SET last_sync_at = now()
  WHERE id = p_connection_id
    AND (user_id = auth.uid() OR user_is_in_household(household_id));
END;
$$;
GRANT EXECUTE ON FUNCTION mark_connection_synced(uuid) TO authenticated;

-- ── 2. Household-wide keys for server-side imports ──────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_household_external_id
  ON transactions (household_id, external_id)
  WHERE external_id IS NOT NULL;

-- ── 3. Tombstones for deliberately deleted imported rows ────────────────────

CREATE TABLE IF NOT EXISTS import_tombstones (
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  import_key   text NOT NULL,            -- the deleted row's dedupe_hash or external_id
  date         date,
  description  text,
  amount       numeric,
  deleted_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, import_key)
);

ALTER TABLE import_tombstones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Household members can view tombstones" ON import_tombstones;
CREATE POLICY "Household members can view tombstones"
  ON import_tombstones FOR SELECT USING (user_is_in_household(household_id));

DROP POLICY IF EXISTS "Household members can add tombstones" ON import_tombstones;
CREATE POLICY "Household members can add tombstones"
  ON import_tombstones FOR INSERT WITH CHECK (user_is_in_household(household_id));

DROP POLICY IF EXISTS "Household members can remove tombstones" ON import_tombstones;
CREATE POLICY "Household members can remove tombstones"
  ON import_tombstones FOR DELETE USING (user_is_in_household(household_id));

NOTIFY pgrst, 'reload schema';
