-- supabase/migrations/20260718000000_uuid_bootstrap.sql
-- Fresh-database bootstrap for the consolidated 20260719 baseline.
--
-- Supabase installs extensions outside `public` on fresh preview branches.
-- The historical consolidated baseline still contains unqualified
-- uuid_generate_v4() defaults while explicitly setting search_path=public.
-- Keep the baseline reproducible without rewriting already-published
-- migration history by providing a tiny public compatibility wrapper first.
-- New schema code should continue to use gen_random_uuid().

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION public.uuid_generate_v4()
RETURNS uuid
LANGUAGE sql
VOLATILE
PARALLEL SAFE
AS $$
  SELECT gen_random_uuid();
$$;

COMMENT ON FUNCTION public.uuid_generate_v4() IS
  'NOXIA fresh-database compatibility wrapper for the consolidated 20260719 baseline; new code uses gen_random_uuid().';
