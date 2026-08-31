-- supabase/migrations/20260718000000_supabase_uuid_compat.sql
-- Compatibility bootstrap for fresh/Supabase branch databases.
--
-- The historical baseline uses the unqualified uuid_generate_v4() function.
-- Supabase may already have uuid-ossp installed in the `extensions` schema while
-- the baseline intentionally sets search_path to `public`; in that case the
-- extension exists but its function is not resolvable and a fresh branch stops
-- before any later NOXIA migration can be tested.
--
-- PostgreSQL/Supabase provides gen_random_uuid(); expose the legacy no-argument
-- name in public so the historical baseline remains replayable without changing
-- its data semantics. This migration sorts before the 20260719 baseline.

SET search_path TO public;

CREATE OR REPLACE FUNCTION public.uuid_generate_v4()
RETURNS uuid
LANGUAGE sql
VOLATILE
AS $$
  SELECT gen_random_uuid();
$$;

COMMENT ON FUNCTION public.uuid_generate_v4() IS
  'NOXIA compatibility alias for historical migrations; delegates to gen_random_uuid().';
