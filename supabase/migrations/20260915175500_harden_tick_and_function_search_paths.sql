-- Harden the remaining mutable search_path helpers and the tick-claim boundary.

-- tick_log remains readable to authenticated clients, but mutations are server-owned.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.tick_log FROM authenticated;
GRANT SELECT ON public.tick_log TO authenticated;

-- Claiming simulation ticks is a server-side operation.
REVOKE EXECUTE ON FUNCTION public.claim_due_ticks(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_ticks(integer, integer) TO service_role;
ALTER FUNCTION public.claim_due_ticks(integer, integer) SET search_path = public, pg_temp;

-- Pin lookup context for the remaining public helpers.
ALTER FUNCTION public.update_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.increment(integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.increment_stock(uuid, text, numeric) SET search_path = public, pg_temp;
ALTER FUNCTION public.calc_travel_time_seconds(uuid, uuid, numeric) SET search_path = public, pg_temp;
ALTER FUNCTION public.uuid_generate_v4() SET search_path = public, pg_temp;
