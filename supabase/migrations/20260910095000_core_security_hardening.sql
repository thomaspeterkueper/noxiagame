-- NOXIA Core security hardening
-- 2026-09-10
--
-- The transactional Game Core is server-authoritative. Browser roles must not
-- bypass API validation by writing bank tables or invoking internal/legacy
-- SECURITY DEFINER functions directly through PostgREST.

set search_path to public;

-- Bank UI/API uses the service-role server adapter exclusively. Preserve that
-- contract and remove the historical direct PostgREST surface.
alter table public.bank_accounts enable row level security;
alter table public.bank_ledger enable row level security;

revoke all on table public.bank_accounts from anon, authenticated;
revoke all on table public.bank_ledger from anon, authenticated;
grant all on table public.bank_accounts to service_role;
grant all on table public.bank_ledger to service_role;

comment on table public.bank_accounts is
  'Server-authoritative NOXIA bank account state. Browser roles have no direct table access; use Game Core APIs.';
comment on table public.bank_ledger is
  'Server-authoritative NOXIA bank audit ledger. Browser roles have no direct table access; use Game Core APIs.';

-- Legacy callable functions and trigger functions were created before the
-- server-only command boundary and inherited PostgreSQL PUBLIC EXECUTE. Keep
-- service-role compatibility while closing direct anon/authenticated RPC use.
revoke all on function public.calc_travel_time_seconds(uuid,uuid,numeric) from public, anon, authenticated;
grant execute on function public.calc_travel_time_seconds(uuid,uuid,numeric) to service_role;

revoke all on function public.increment_stock(uuid,text,numeric) from public, anon, authenticated;
grant execute on function public.increment_stock(uuid,text,numeric) to service_role;

revoke all on function public.noxia_consume_build_resources() from public, anon, authenticated;
grant execute on function public.noxia_consume_build_resources() to service_role;

revoke all on function public.noxia_record_player_build_event() from public, anon, authenticated;
grant execute on function public.noxia_record_player_build_event() to service_role;

revoke all on function public.noxia_record_tile_entity_state() from public, anon, authenticated;
grant execute on function public.noxia_record_tile_entity_state() to service_role;

revoke all on function public.release_ship_docking_assignment_on_deactivate() from public, anon, authenticated;
grant execute on function public.release_ship_docking_assignment_on_deactivate() to service_role;
