-- ============================================================================
-- NAME A NEW USER'S HOUSEHOLD IN THEIR LANGUAGE
-- ============================================================================
-- Why: the household Ooga creates at sign-up was always named in English
-- ("Dana's Household"), including for people who signed up in Hebrew. The app now
-- saves the language chosen at sign-up in the user's metadata (`language`), so the
-- trigger can name the household "משק הבית של דנה" for them.
-- What changes: public.handle_new_user() (from 009). English sign-ups are named
-- exactly as before; existing households are not renamed.
-- Deploy order: Safe to run before or after deploying any app version. Before the
-- app sends `language`, every sign-up takes the English branch, as today.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_household_id UUID;
  user_first_name TEXT;
  household_name TEXT;
BEGIN
  IF NEW.raw_user_meta_data->>'language' = 'he' THEN
    -- An empty name would read "משק הבית של ", so it counts as no name; a long one is cut to 50
    user_first_name := LEFT(NULLIF(BTRIM(COALESCE(
      NEW.raw_user_meta_data->>'first_name',
      SPLIT_PART(NEW.raw_user_meta_data->>'full_name', ' ', 1)
    )), ''), 50);
    household_name := CASE
      WHEN user_first_name IS NULL THEN 'משק הבית שלי'
      ELSE 'משק הבית של ' || user_first_name
    END;
  ELSE
    -- Unchanged from 009
    user_first_name := COALESCE(
      NEW.raw_user_meta_data->>'first_name',
      SPLIT_PART(NEW.raw_user_meta_data->>'full_name', ' ', 1),
      'My'
    );
    household_name := user_first_name || '''s Household';
  END IF;

  -- Create a personal household for the new user
  INSERT INTO public.households (name, created_by)
  VALUES (household_name, NEW.id)
  RETURNING id INTO new_household_id;

  -- Add the user as the owner of their household
  INSERT INTO public.household_members (household_id, user_id, role, invited_by)
  VALUES (new_household_id, NEW.id, 'owner', NEW.id);

  RETURN NEW;
END;
$$;

-- A trigger function: nobody calls it directly (as in 037). CREATE OR REPLACE keeps
-- the existing grants; this repeats the revoke so the file stands on its own.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- ── Check ───────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF has_function_privilege('anon', 'public.handle_new_user()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.handle_new_user()', 'EXECUTE') THEN
    RAISE EXCEPTION 'handle_new_user() is executable by anon or authenticated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created' AND tgrelid = 'auth.users'::regclass
  ) THEN
    RAISE EXCEPTION 'on_auth_user_created trigger is missing on auth.users';
  END IF;
END;
$$;

-- After running, this should show "search_path=public" and the new body:
-- SELECT proconfig, prosrc LIKE '%משק הבית של%' AS has_hebrew_branch
--   FROM pg_proc WHERE oid = 'public.handle_new_user()'::regprocedure;
