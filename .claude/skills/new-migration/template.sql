-- ============================================================================
-- <TITLE IN CAPS: WHAT THIS MIGRATION DOES>
-- ============================================================================
-- Why: <the problem in plain words, and what the app does with this change>.
-- What changes: <tables, columns, policies, functions>.
-- Deploy order: Safe to run before or after deploying any app version.
--   (Or: run this BEFORE merging the app change, because <reason>.)

-- ── New table ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS example_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  created_by   uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  name         text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE example_items IS '<one line: what a row is>';

CREATE INDEX IF NOT EXISTS idx_example_items_household ON example_items (household_id);

ALTER TABLE example_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Household members can view example items" ON example_items;
CREATE POLICY "Household members can view example items"
  ON example_items FOR SELECT
  USING (user_is_in_household(household_id));

DROP POLICY IF EXISTS "Household members can add example items" ON example_items;
CREATE POLICY "Household members can add example items"
  ON example_items FOR INSERT
  WITH CHECK (user_is_in_household(household_id));

DROP POLICY IF EXISTS "Household members can update example items" ON example_items;
CREATE POLICY "Household members can update example items"
  ON example_items FOR UPDATE
  USING (user_is_in_household(household_id))
  WITH CHECK (user_is_in_household(household_id));

DROP POLICY IF EXISTS "Owners can delete example items" ON example_items;
CREATE POLICY "Owners can delete example items"
  ON example_items FOR DELETE
  USING (user_is_household_owner_or_admin(household_id));

-- ── New column on an existing table ─────────────────────────────────────────

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS example_note text; -- nullable: the current app keeps working

COMMENT ON COLUMN transactions.example_note IS '<what it holds and who sets it>';

-- ── Function the app calls through supabase.rpc() ───────────────────────────

CREATE OR REPLACE FUNCTION example_action(p_item_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item example_items;
BEGIN
  SELECT * INTO item FROM example_items WHERE id = p_item_id FOR UPDATE;

  IF item.id IS NULL THEN
    RAISE EXCEPTION 'Item not found';
  END IF;
  IF NOT user_is_in_household(item.household_id) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  -- <the work>
END;
$$;

REVOKE EXECUTE ON FUNCTION example_action(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION example_action(uuid) TO authenticated;

-- ── Self-check: abort if the result isn't what we expect ────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'example_items' AND relrowsecurity
  ) THEN
    RAISE EXCEPTION 'RLS is not enabled on example_items';
  END IF;
  IF has_function_privilege('anon', 'public.example_action(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon can execute example_action';
  END IF;
END $$;
