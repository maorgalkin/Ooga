-- ============================================================================
-- NEW FUNCTIONS ARE NOT ANON-EXECUTABLE BY DEFAULT
-- ============================================================================
-- Two default privileges made every new function callable through
-- /rest/v1/rpc with just the anon key (see migration 037):
--   * Postgres' built-in default: EXECUTE to PUBLIC, which anon inherits.
--     It can only be revoked globally, not per schema.
--   * Supabase's default for postgres in `public`: EXECUTE to anon,
--     authenticated and service_role.
--
-- From now on a function created by postgres (migrations, SQL editor) gets:
--   public schema: postgres, authenticated, service_role
--   other schemas: postgres only, plus that schema's own defaults
-- A function anon genuinely needs must be granted to anon explicitly.
-- Existing functions are unchanged.

ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;

-- Abort the migration if a new function still ends up callable by anon
DO $$
BEGIN
  CREATE FUNCTION public._default_privileges_probe() RETURNS int LANGUAGE sql AS 'SELECT 1';
  IF has_function_privilege('anon', 'public._default_privileges_probe()', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public._default_privileges_probe()', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public._default_privileges_probe()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Unexpected default EXECUTE privileges on new functions in public';
  END IF;
  DROP FUNCTION public._default_privileges_probe();
END $$;
