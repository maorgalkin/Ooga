-- ============================================================================
-- NOTHING POINTS ACROSS HOUSEHOLDS: TRANSACTIONS, CATEGORIES, CONNECTED ACCOUNTS
-- ============================================================================
-- Why: row-level security checks a row's own household_id, but not where it
-- points or which household a person may file their own rows under:
--   * a transaction could point at another household's category (which then
--     can't be deleted there: original_category_id has no ON DELETE action),
--     connected account or import;
--   * a person could create or move their own category or connected account
--     into any household (014 and 032 only checked the owner), whose members
--     would then see it, and for an account, import with its stored credentials.
-- The only rows in production pointing outside their household are two
-- categories from before categories belonged to households; this assigns them.
-- What changes:
--   1. Categories with no household get their owner's household, when the owner
--      belongs to exactly one. If that household already has a live category of
--      the same owner and name, transactions are pointed at that one instead and
--      the old category is left as it is (nothing is deleted).
--   2. A trigger on transactions rejects a link to another household's category,
--      connected account or import. It checks links a write sets or changes (and
--      all of them when the row's household or author changes), so editing other
--      fields of an existing row is never blocked. A category or account with no
--      household is accepted only from its owner, while a member of the row's
--      household.
--   3. Categories and connected accounts can be created or moved only into a
--      household the person belongs to (or none).
-- Deploy order: Safe to run before or after deploying any app version. The app
-- version that ships with it looks up categories and accounts within the
-- person's household, so someone who switched households doesn't pick their
-- old household's ones.

-- ── 1. Categories from before households ────────────────────────────────────

DO $$
DECLARE
  c record;
  v_household uuid;
  v_twin uuid;
BEGIN
  FOR c IN SELECT id, user_id, name, deleted_at FROM categories WHERE household_id IS NULL
  LOOP
    SELECT min(household_id::text)::uuid INTO v_household FROM household_members
    WHERE user_id = c.user_id HAVING count(*) = 1;
    CONTINUE WHEN v_household IS NULL;  -- owner in no household, or in several: leave it

    -- A twin only clashes (unique name per owner and household) when both are live
    v_twin := NULL;
    IF c.deleted_at IS NULL THEN
      SELECT id INTO v_twin FROM categories
      WHERE user_id = c.user_id AND household_id = v_household AND name = c.name
        AND id <> c.id AND deleted_at IS NULL
      ORDER BY created_at LIMIT 1;
    END IF;

    IF v_twin IS NULL THEN
      UPDATE categories SET household_id = v_household WHERE id = c.id;
    ELSE
      UPDATE transactions SET category_id = v_twin WHERE category_id = c.id AND household_id = v_household;
      UPDATE transactions SET original_category_id = v_twin WHERE original_category_id = c.id AND household_id = v_household;
    END IF;
  END LOOP;
END $$;

-- ── 2. Transactions link only within their household ────────────────────────

-- Runs with the owner's rights so it can see the linked row whatever the caller's
-- row-level security hides; it only reads, and only answers "same household or not".
-- A missing row and another household's row give the same error.
CREATE OR REPLACE FUNCTION check_transaction_household_references()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_all boolean := TG_OP = 'INSERT';
  v_owner_here boolean;
BEGIN
  IF NOT v_all THEN
    v_all := NEW.household_id IS DISTINCT FROM OLD.household_id OR NEW.user_id IS DISTINCT FROM OLD.user_id;
  END IF;
  -- A household-less category or account counts only for its owner, while in this household
  v_owner_here := EXISTS (SELECT 1 FROM household_members m WHERE m.user_id = NEW.user_id AND m.household_id = NEW.household_id);

  IF NEW.category_id IS NOT NULL AND (v_all OR NEW.category_id IS DISTINCT FROM OLD.category_id)
     AND NOT EXISTS (SELECT 1 FROM categories c WHERE c.id = NEW.category_id
       AND (c.household_id = NEW.household_id OR (c.household_id IS NULL AND c.user_id = NEW.user_id AND v_owner_here))) THEN
    RAISE EXCEPTION 'category belongs to another household' USING ERRCODE = '42501';
  END IF;
  IF NEW.original_category_id IS NOT NULL AND (v_all OR NEW.original_category_id IS DISTINCT FROM OLD.original_category_id)
     AND NOT EXISTS (SELECT 1 FROM categories c WHERE c.id = NEW.original_category_id
       AND (c.household_id = NEW.household_id OR (c.household_id IS NULL AND c.user_id = NEW.user_id AND v_owner_here))) THEN
    RAISE EXCEPTION 'category belongs to another household' USING ERRCODE = '42501';
  END IF;
  IF NEW.bank_connection_id IS NOT NULL AND (v_all OR NEW.bank_connection_id IS DISTINCT FROM OLD.bank_connection_id)
     AND NOT EXISTS (SELECT 1 FROM bank_connections b WHERE b.id = NEW.bank_connection_id
       AND (b.household_id = NEW.household_id OR (b.household_id IS NULL AND b.user_id = NEW.user_id AND v_owner_here))) THEN
    RAISE EXCEPTION 'connected account belongs to another household' USING ERRCODE = '42501';
  END IF;
  IF NEW.paid_with_connection_id IS NOT NULL AND (v_all OR NEW.paid_with_connection_id IS DISTINCT FROM OLD.paid_with_connection_id)
     AND NOT EXISTS (SELECT 1 FROM bank_connections b WHERE b.id = NEW.paid_with_connection_id
       AND (b.household_id = NEW.household_id OR (b.household_id IS NULL AND b.user_id = NEW.user_id AND v_owner_here))) THEN
    RAISE EXCEPTION 'connected account belongs to another household' USING ERRCODE = '42501';
  END IF;
  IF NEW.import_session_id IS NOT NULL AND (v_all OR NEW.import_session_id IS DISTINCT FROM OLD.import_session_id)
     AND NOT EXISTS (SELECT 1 FROM bank_import_sessions s WHERE s.id = NEW.import_session_id AND s.household_id = NEW.household_id) THEN
    RAISE EXCEPTION 'import belongs to another household' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION check_transaction_household_references() IS
  'Trigger: a transaction may only link to categories, connected accounts and imports of its own household.';

-- Trigger functions can't be called directly; this only keeps the grants tidy (as in 037)
REVOKE EXECUTE ON FUNCTION check_transaction_household_references() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS transactions_household_references ON transactions;
CREATE TRIGGER transactions_household_references
  BEFORE INSERT OR UPDATE OF household_id, user_id, category_id, original_category_id,
                             bank_connection_id, paid_with_connection_id, import_session_id
  ON transactions
  FOR EACH ROW EXECUTE FUNCTION check_transaction_household_references();

-- ── 3. Own categories and accounts only in one's own household ──────────────

DROP POLICY IF EXISTS "Users can insert own categories" ON categories;
CREATE POLICY "Users can insert own categories"
  ON categories FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND (household_id IS NULL OR user_is_in_household(household_id)));

DROP POLICY IF EXISTS "Users can update own categories" ON categories;
CREATE POLICY "Users can update own categories"
  ON categories FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND (household_id IS NULL OR user_is_in_household(household_id)));

-- 036 already narrowed the insert policy; the update policy (032) still only checked the owner
DROP POLICY IF EXISTS "Users can update their own bank connections" ON bank_connections;
CREATE POLICY "Users can update their own bank connections"
  ON bank_connections FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND (household_id IS NULL OR user_is_in_household(household_id)));

-- ── Self-check ──────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'transactions_household_references'
                 AND tgrelid = 'public.transactions'::regclass AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'transactions_household_references trigger is missing';
  END IF;
  IF has_function_privilege('anon', 'public.check_transaction_household_references()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.check_transaction_household_references()', 'EXECUTE') THEN
    RAISE EXCEPTION 'check_transaction_household_references must not be callable directly';
  END IF;
  IF (SELECT with_check FROM pg_policies WHERE tablename = 'bank_connections'
        AND policyname = 'Users can update their own bank connections') NOT ILIKE '%user_is_in_household%' THEN
    RAISE EXCEPTION 'bank_connections update policy was not narrowed';
  END IF;
  -- Report (don't fail on) existing links across households: the trigger leaves them be until they change
  IF EXISTS (SELECT 1 FROM transactions t JOIN categories c ON c.id IN (t.category_id, t.original_category_id)
             WHERE c.household_id IS DISTINCT FROM t.household_id AND NOT (c.household_id IS NULL AND c.user_id = t.user_id))
  OR EXISTS (SELECT 1 FROM transactions t JOIN bank_connections b ON b.id IN (t.bank_connection_id, t.paid_with_connection_id)
             WHERE b.household_id IS DISTINCT FROM t.household_id AND NOT (b.household_id IS NULL AND b.user_id = t.user_id))
  OR EXISTS (SELECT 1 FROM transactions t JOIN bank_import_sessions s ON s.id = t.import_session_id
             WHERE s.household_id <> t.household_id) THEN
    RAISE NOTICE 'Some existing transactions still link to another household (left as they are; see the PR for the query)';
  END IF;
  RAISE NOTICE 'Migration 044 OK: transactions, categories and connected accounts stay within their household';
END $$;
