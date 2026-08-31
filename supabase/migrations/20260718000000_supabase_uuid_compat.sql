-- supabase/migrations/20260718000000_supabase_uuid_compat.sql
-- Compatibility bootstrap for fresh/Supabase branch databases.
--
-- The consolidated 20260719 baseline intentionally replays the historical
-- schema but omitted a few prerequisites that existed in archived migration
-- 001a_noxia_tables.sql. On Supabase, uuid-ossp may also live outside `public`
-- while the baseline sets search_path to `public`.
--
-- This bootstrap restores only those historical prerequisites before the
-- baseline runs. New schema code should continue to use gen_random_uuid().

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

-- Historical enum definitions from _archive/001a_noxia_tables.sql.
DO $$ BEGIN
  CREATE TYPE building_type AS ENUM ('mine', 'solar', 'habitat');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ship_type AS ENUM ('freighter');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ship_status AS ENUM ('docked', 'transit');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE event_type AS ENUM ('mine_collapse', 'habitat_built', 'power_outage');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
