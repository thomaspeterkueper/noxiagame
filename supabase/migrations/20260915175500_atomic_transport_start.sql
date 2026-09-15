-- NOXIA Core: atomic create -> loading -> in_transit transport command
-- 2026-09-15
--
-- Composition only: canonical validation and state transitions remain owned by
-- noxia_create_transport_job, noxia_begin_loading_transport_job and
-- noxia_start_transport_job. Any exception rolls the entire PostgreSQL statement
-- back, including reservations and cargo transfer.

set search_path to public;

create or replace function public.noxia_create_and_start_transport_job(
  p_command_id uuid,
  p_actor_profile_id uuid,
  p_location_id uuid,
  p_domain text,
  p_source_inventory_id uuid,
  p_destination_inventory_id uuid,
  p_vehicle_inventory_id uuid,
  p_vehicle_role text,
  p_resource public.resource_type,
  p_amount integer,
  p_route_snapshot jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_created jsonb;
  v_job_id uuid;
  v_loading jsonb;
  v_started jsonb;
begin
  if p_command_id is null then
    raise exception 'NOXIA_TRANSPORT_COMMAND_ID_REQUIRED' using errcode = 'P0001';
  end if;

  v_created := public.noxia_create_transport_job(
    p_command_id,
    p_actor_profile_id,
    p_location_id,
    p_domain,
    p_source_inventory_id,
    p_destination_inventory_id,
    p_vehicle_inventory_id,
    p_vehicle_role,
    p_resource,
    p_amount,
    p_route_snapshot
  );

  v_job_id := nullif(v_created ->> 'id', '')::uuid;
  if v_job_id is null then
    raise exception 'NOXIA_TRANSPORT_JOB_CREATE_RESULT_INVALID' using errcode = 'P0001';
  end if;

  -- A retry with the same command id may already be in transit. Never move a
  -- successfully started job back to loading.
  if (v_created ->> 'status') = 'in_transit' then
    return v_created || jsonb_build_object('atomicStart', true, 'idempotent', true);
  end if;

  v_loading := public.noxia_begin_loading_transport_job(v_job_id, p_actor_profile_id);
  v_started := public.noxia_start_transport_job(v_job_id, p_actor_profile_id);

  return v_started || jsonb_build_object(
    'atomicStart', true,
    'createIdempotent', coalesce((v_created ->> 'idempotent')::boolean, false),
    'loadingIdempotent', coalesce((v_loading ->> 'idempotent')::boolean, false)
  );
end;
$function$;

revoke all on function public.noxia_create_and_start_transport_job(
  uuid,uuid,uuid,text,uuid,uuid,uuid,text,public.resource_type,integer,jsonb
) from public, anon, authenticated;
grant execute on function public.noxia_create_and_start_transport_job(
  uuid,uuid,uuid,text,uuid,uuid,uuid,text,public.resource_type,integer,jsonb
) to service_role;

comment on function public.noxia_create_and_start_transport_job(
  uuid,uuid,uuid,text,uuid,uuid,uuid,text,public.resource_type,integer,jsonb
) is 'Atomically composes the canonical transport create, loading and start functions. Intended for authenticated server-side commands via service_role only.';
