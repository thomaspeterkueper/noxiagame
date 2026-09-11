-- Atomic/idempotent definition of a TransportJob itinerary.
-- Legs and cargo handovers are one domain command and therefore one transaction.

create table if not exists public.transport_itinerary_commands (
  command_id uuid primary key,
  actor_profile_id uuid not null references public.profiles(id) on delete cascade,
  job_id uuid not null unique references public.transport_jobs(id) on delete cascade,
  legs jsonb not null default '[]'::jsonb,
  handovers jsonb not null default '[]'::jsonb,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint transport_itinerary_commands_legs_array_check check (jsonb_typeof(legs) = 'array'),
  constraint transport_itinerary_commands_handovers_array_check check (jsonb_typeof(handovers) = 'array')
);

alter table public.transport_itinerary_commands enable row level security;
revoke all on table public.transport_itinerary_commands from public, anon, authenticated;
grant select, insert, update, delete on table public.transport_itinerary_commands to service_role;

create or replace function public.noxia_define_transport_itinerary(
  p_command_id uuid,
  p_actor_profile_id uuid,
  p_job_id uuid,
  p_legs jsonb,
  p_handovers jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_existing public.transport_itinerary_commands%rowtype;
  v_job public.transport_jobs%rowtype;
  v_leg jsonb;
  v_handover jsonb;
  v_result jsonb;
  v_leg_count integer := 0;
  v_handover_count integer := 0;
begin
  if p_command_id is null or p_actor_profile_id is null or p_job_id is null then
    raise exception 'NOXIA_TRANSPORT_ITINERARY_INVALID_ARGUMENT' using errcode = 'P0001';
  end if;
  if jsonb_typeof(coalesce(p_legs, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_handovers, '[]'::jsonb)) <> 'array' then
    raise exception 'NOXIA_TRANSPORT_ITINERARY_INVALID_PAYLOAD' using errcode = 'P0001';
  end if;

  select * into v_existing from public.transport_itinerary_commands where command_id = p_command_id;
  if found then
    if v_existing.actor_profile_id <> p_actor_profile_id
       or v_existing.job_id <> p_job_id
       or v_existing.legs <> coalesce(p_legs, '[]'::jsonb)
       or v_existing.handovers <> coalesce(p_handovers, '[]'::jsonb) then
      raise exception 'NOXIA_TRANSPORT_ITINERARY_COMMAND_CONFLICT' using errcode = 'P0001';
    end if;
    return v_existing.result || jsonb_build_object('idempotent', true);
  end if;

  select * into v_job from public.transport_jobs where id = p_job_id for update;
  if not found then raise exception 'NOXIA_TRANSPORT_JOB_NOT_FOUND' using errcode = 'P0001'; end if;
  if v_job.actor_profile_id <> p_actor_profile_id then raise exception 'NOXIA_TRANSPORT_ITINERARY_FORBIDDEN' using errcode = 'P0001'; end if;
  if v_job.status <> 'reserved' then raise exception 'NOXIA_TRANSPORT_ITINERARY_STATE_INVALID' using errcode = 'P0001'; end if;
  if exists(select 1 from public.transport_job_legs where job_id = p_job_id)
     or exists(select 1 from public.transport_job_handovers where job_id = p_job_id)
     or exists(select 1 from public.transport_itinerary_commands where job_id = p_job_id) then
    raise exception 'NOXIA_TRANSPORT_ITINERARY_ALREADY_DEFINED' using errcode = 'P0001';
  end if;

  for v_leg in select value from jsonb_array_elements(coalesce(p_legs, '[]'::jsonb)) loop
    if coalesce((v_leg->>'sequenceNo')::integer, -1) < 0
       or (v_leg->>'domain') is null
       or (v_leg->>'sourceInventoryId') is null
       or (v_leg->>'destinationInventoryId') is null then
      raise exception 'NOXIA_TRANSPORT_ITINERARY_INVALID_LEG' using errcode = 'P0001';
    end if;

    insert into public.transport_job_legs(
      job_id, sequence_no, domain, source_inventory_id, destination_inventory_id,
      vehicle_inventory_id, route_snapshot
    ) values (
      p_job_id,
      (v_leg->>'sequenceNo')::integer,
      v_leg->>'domain',
      (v_leg->>'sourceInventoryId')::uuid,
      (v_leg->>'destinationInventoryId')::uuid,
      nullif(v_leg->>'vehicleInventoryId','')::uuid,
      coalesce(v_leg->'routeSnapshot','{}'::jsonb)
    );
    v_leg_count := v_leg_count + 1;
  end loop;

  for v_handover in select value from jsonb_array_elements(coalesce(p_handovers, '[]'::jsonb)) loop
    if coalesce((v_handover->>'sequenceNo')::integer, -1) < 0
       or (v_handover->>'sourceInventoryId') is null
       or (v_handover->>'targetInventoryId') is null
       or (v_handover->>'resource') is null
       or coalesce((v_handover->>'amount')::integer, 0) <= 0 then
      raise exception 'NOXIA_TRANSPORT_ITINERARY_INVALID_HANDOVER' using errcode = 'P0001';
    end if;
    if coalesce((v_handover->>'requiresDocking')::boolean, false)
       and nullif(v_handover->>'dockingConnectionId','') is null then
      raise exception 'NOXIA_TRANSPORT_ITINERARY_DOCKING_CONNECTION_REQUIRED' using errcode = 'P0001';
    end if;

    insert into public.transport_job_handovers(
      job_id, sequence_no, source_inventory_id, target_inventory_id, resource,
      amount, requires_docking, docking_connection_id
    ) values (
      p_job_id,
      (v_handover->>'sequenceNo')::integer,
      (v_handover->>'sourceInventoryId')::uuid,
      (v_handover->>'targetInventoryId')::uuid,
      (v_handover->>'resource')::public.resource_type,
      (v_handover->>'amount')::integer,
      coalesce((v_handover->>'requiresDocking')::boolean, false),
      nullif(v_handover->>'dockingConnectionId','')::uuid
    );
    v_handover_count := v_handover_count + 1;
  end loop;

  v_result := jsonb_build_object(
    'jobId', p_job_id,
    'legCount', v_leg_count,
    'handoverCount', v_handover_count,
    'idempotent', false
  );

  insert into public.transport_itinerary_commands(command_id, actor_profile_id, job_id, legs, handovers, result)
  values (
    p_command_id,
    p_actor_profile_id,
    p_job_id,
    coalesce(p_legs, '[]'::jsonb),
    coalesce(p_handovers, '[]'::jsonb),
    v_result
  );
  return v_result;
end;
$function$;

revoke all on function public.noxia_define_transport_itinerary(uuid,uuid,uuid,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.noxia_define_transport_itinerary(uuid,uuid,uuid,jsonb,jsonb) to service_role;
