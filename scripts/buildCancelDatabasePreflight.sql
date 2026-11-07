-- #615 / PR #627: read-only Supabase clone preflight, before integration tests.
-- Run only against a disposable database with the draft migration applied.
-- A TRUE ready_for_integration is NOT proof of atomicity or authorization.
-- No player/build identifiers, prices or private data are returned.
with cancellation as (
  select p.oid, p.prosecdef, pg_get_functiondef(p.oid) as definition
  from pg_proc p
  where p.oid = to_regprocedure('public.noxia_cancel_build(uuid,uuid)')
), start_build as (
  select pg_get_functiondef(p.oid) as definition
  from pg_proc p
  where p.oid = to_regprocedure('public.noxia_start_build(uuid,text,uuid,integer,timestamptz,smallint,integer,integer,text,double precision,double precision,double precision,double precision,double precision,double precision,uuid,text,text,double precision,double precision,double precision,double precision,double precision,double precision,double precision,double precision,text)')
), checks as (
  select
    to_regclass('public.player_builds') is not null as builds_table_present,
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'player_builds'
        and column_name = 'refund_credits_snapshot' and data_type = 'integer'
    ) as refund_snapshot_column_present,
    exists (
      select 1 from pg_constraint
      where conrelid = to_regclass('public.player_builds')
        and conname = 'player_builds_refund_snapshot_nonnegative'
        and contype = 'c' and convalidated
    ) as refund_constraint_validated,
    exists (select 1 from cancellation) as cancel_rpc_present,
    coalesce((select prosecdef from cancellation), false) as cancel_rpc_security_definer,
    coalesce((select definition ~* 'for[[:space:]]+update' from cancellation), false) as cancel_rpc_has_row_lock,
    coalesce((select definition ~* 'profile_id[[:space:]]+is[[:space:]]+distinct[[:space:]]+from[[:space:]]+p_profile_id' from cancellation), false) as cancel_rpc_has_ownership_guard,
    coalesce((select definition ~* 'refund_credits_snapshot[[:space:]]+is[[:space:]]+null' from cancellation), false) as cancel_rpc_rejects_unknown_refund,
    coalesce((select definition ~* 'refund_credits_snapshot' from start_build), false) as start_rpc_persists_refund_snapshot,
    coalesce(has_function_privilege('anon', to_regprocedure('public.noxia_cancel_build(uuid,uuid)'), 'EXECUTE'), false) as anon_can_execute_cancel,
    coalesce(has_function_privilege('authenticated', to_regprocedure('public.noxia_cancel_build(uuid,uuid)'), 'EXECUTE'), false) as authenticated_can_execute_cancel,
    coalesce(has_function_privilege('service_role', to_regprocedure('public.noxia_cancel_build(uuid,uuid)'), 'EXECUTE'), false) as service_role_can_execute_cancel
)
select checks.*,
  (builds_table_present and refund_snapshot_column_present
    and refund_constraint_validated and cancel_rpc_present
    and cancel_rpc_security_definer and cancel_rpc_has_row_lock
    and cancel_rpc_has_ownership_guard and cancel_rpc_rejects_unknown_refund
    and start_rpc_persists_refund_snapshot
    and not anon_can_execute_cancel and not authenticated_can_execute_cancel
    and service_role_can_execute_cancel) as ready_for_integration
from checks;
