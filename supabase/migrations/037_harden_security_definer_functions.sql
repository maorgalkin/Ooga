-- ============================================================================
-- HARDEN SECURITY DEFINER FUNCTIONS
-- ============================================================================
-- Postgres lets PUBLIC execute every new function, so each SECURITY DEFINER
-- function in `public` was callable through /rest/v1/rpc/<name> with just the
-- anon key, several of them writing or reading any user's data by id.
-- (Supabase advisor lints 0028, 0029, 0011.)
--
-- 1. Functions the app never calls: only postgres / service_role may run them.
-- 2. Functions the app calls, and the helpers RLS policies call: signed-in
--    users only, never anon.
-- 3. Trigger functions: nobody (triggers still fire; Postgres checks EXECUTE
--    only when a trigger is created).
-- 4. get_household_members_with_emails only answers for the caller's household.
-- 5. Fixed search_path on every function that lacked one.
--
-- The service role keeps its explicit EXECUTE grants throughout.
-- Safe to run before or after deploying any app version.

-- ── 1. Not called by the app ────────────────────────────────────────────────

-- One-off category migration / cleanup helpers. (migrate_user_categories is
-- also broken: it calls migrate_categories_from_budgets, which no longer exists.)
REVOKE EXECUTE ON FUNCTION cleanup_duplicate_categories(uuid)         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION cleanup_all_duplicate_categories()         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION migrate_categories_from_transactions(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION migrate_user_categories(uuid)              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION update_transaction_category_ids(uuid)      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION cleanup_old_alert_views()                  FROM PUBLIC, anon, authenticated;

-- Unused lookups that answered for any user / household id
REVOKE EXECUTE ON FUNCTION get_user_household_id(uuid)                FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION is_household_owner(uuid, uuid)             FROM PUBLIC, anon, authenticated;

-- Unused; it also never checks that the caller belongs to p_household_id, so
-- add a user_is_in_household() guard before granting it to authenticated again.
REVOKE EXECUTE ON FUNCTION get_or_create_monthly_budget(uuid, integer, integer) FROM PUBLIC, anon, authenticated;

-- ── 2. Called by the app or by RLS policies: signed-in users only ────────────

-- App RPCs (categoryService, householdService, calDirectService)
REVOKE EXECUTE ON FUNCTION merge_categories(uuid, uuid, text)          FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION undo_category_merge(uuid)                   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION mark_connection_synced(uuid)                FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION get_household_members_with_emails(uuid)     FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION merge_categories(uuid, uuid, text)          TO authenticated;
GRANT  EXECUTE ON FUNCTION undo_category_merge(uuid)                   TO authenticated;
GRANT  EXECUTE ON FUNCTION mark_connection_synced(uuid)                TO authenticated;
GRANT  EXECUTE ON FUNCTION get_household_members_with_emails(uuid)     TO authenticated;

-- Used inside RLS policies on household_members, family_members,
-- bank_connections and import_tombstones, which run as the querying user
REVOKE EXECUTE ON FUNCTION user_is_in_household(uuid)                  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION user_is_household_owner_or_admin(uuid)      FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION user_is_in_household(uuid)                  TO authenticated;
GRANT  EXECUTE ON FUNCTION user_is_household_owner_or_admin(uuid)      TO authenticated;

-- ── 3. Trigger functions ────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION handle_new_user()                           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION auto_create_family_member_tag()             FROM PUBLIC, anon, authenticated;

-- ── 4. Household members: caller's own household only ───────────────────────

CREATE OR REPLACE FUNCTION get_household_members_with_emails(p_household_id uuid)
RETURNS TABLE(id uuid, household_id uuid, user_id uuid, role text, joined_at timestamptz, invited_by uuid, email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT user_is_in_household(p_household_id) THEN
    RAISE EXCEPTION 'Not a member of this household' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    hm.id,
    hm.household_id,
    hm.user_id,
    hm.role::TEXT,
    hm.joined_at,
    hm.invited_by,
    COALESCE(
      au.raw_user_meta_data->>'first_name',
      SPLIT_PART((au.raw_user_meta_data->>'full_name'), ' ', 1),
      SPLIT_PART(au.email::TEXT, '@', 1),
      'Unknown'
    ) as email
  FROM public.household_members hm
  LEFT JOIN auth.users au ON hm.user_id = au.id
  WHERE hm.household_id = p_household_id
  ORDER BY hm.joined_at ASC;
END;
$$;

-- ── 5. Fixed search_path ────────────────────────────────────────────────────

ALTER FUNCTION get_user_household_id(uuid)                                   SET search_path = public;
ALTER FUNCTION is_household_owner(uuid, uuid)                                SET search_path = public;
ALTER FUNCTION merge_categories(uuid, uuid, text)                            SET search_path = public;
ALTER FUNCTION undo_category_merge(uuid)                                     SET search_path = public;
ALTER FUNCTION migrate_user_categories(uuid)                                 SET search_path = public;
ALTER FUNCTION migrate_categories_from_transactions(uuid)                    SET search_path = public;
ALTER FUNCTION update_transaction_category_ids(uuid)                         SET search_path = public;
ALTER FUNCTION cleanup_duplicate_categories(uuid)                            SET search_path = public;
ALTER FUNCTION cleanup_all_duplicate_categories()                            SET search_path = public;
ALTER FUNCTION cleanup_old_alert_views()                                     SET search_path = public;
ALTER FUNCTION update_category_adjustment_history(uuid, text, text, numeric) SET search_path = public;
ALTER FUNCTION update_categories_updated_at()                                SET search_path = public;
ALTER FUNCTION update_category_history_timestamp()                           SET search_path = public;
ALTER FUNCTION update_household_timestamp()                                  SET search_path = public;
ALTER FUNCTION update_monthly_budget_timestamp()                             SET search_path = public;
ALTER FUNCTION update_personal_budget_timestamp()                            SET search_path = public;

NOTIFY pgrst, 'reload schema';
