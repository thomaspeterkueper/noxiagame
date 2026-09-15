-- Harden legacy server-only mutation paths.
-- Client roles may keep intentional read access, but authoritative state changes
-- remain service-side and SECURITY DEFINER routines are not public RPCs.

-- Daily tasks: authenticated players may read only their own tasks.
DROP POLICY IF EXISTS "Service kann schreiben" ON public.daily_tasks;
DROP POLICY IF EXISTS "Eigene Tagesaufgaben lesen" ON public.daily_tasks;
CREATE POLICY daily_tasks_select_own
  ON public.daily_tasks
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = profile_id);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.daily_tasks FROM authenticated;
GRANT SELECT ON public.daily_tasks TO authenticated;

-- Foundation slides are readable by authenticated players but are authored server-side.
DROP POLICY IF EXISTS "Service schreibt Folien" ON public.foundation_folien;
DROP POLICY IF EXISTS "Folien lesen" ON public.foundation_folien;
CREATE POLICY foundation_folien_select
  ON public.foundation_folien
  FOR SELECT
  TO authenticated
  USING (true);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.foundation_folien FROM authenticated;
GRANT SELECT ON public.foundation_folien TO authenticated;

-- Legacy SECURITY DEFINER mutations must be server-only. Trigger functions remain
-- callable by their installed triggers; direct PostgREST/RPC execution is revoked.
REVOKE EXECUTE ON FUNCTION public.add_to_stock(uuid, public.resource_type, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_to_stock(uuid, public.resource_type, integer)
  TO service_role;
ALTER FUNCTION public.add_to_stock(uuid, public.resource_type, integer)
  SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.collect_property_tax(bigint)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.collect_property_tax(bigint)
  TO service_role;
ALTER FUNCTION public.collect_property_tax(bigint)
  SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.grant_starting_energy(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_starting_energy(uuid)
  TO service_role;
ALTER FUNCTION public.grant_starting_energy(uuid)
  SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.handle_new_profile()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_profile()
  TO service_role;
ALTER FUNCTION public.handle_new_profile()
  SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.handle_new_user()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user()
  TO service_role;
ALTER FUNCTION public.handle_new_user()
  SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.recalculate_governors()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_governors()
  TO service_role;
ALTER FUNCTION public.recalculate_governors()
  SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.upsert_location_reputation(uuid, uuid, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_location_reputation(uuid, uuid, integer, integer)
  TO service_role;
ALTER FUNCTION public.upsert_location_reputation(uuid, uuid, integer, integer)
  SET search_path = public, pg_temp;
