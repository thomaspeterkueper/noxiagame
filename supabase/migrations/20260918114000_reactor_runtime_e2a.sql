-- E2a: authoritative reactor runtime state through the existing
-- simulation_events -> entity_states Core path.
--
-- This migration deliberately creates no reactor-specific state table and
-- stores no nominal/available MW. Engineering nameplate power remains in the
-- canonical building seed; available MW is a read-model derivation.

create or replace function public.noxia_set_reactor_runtime(
  p_command_id uuid,
  p_tile_entity_id uuid,
  p_mode text,
  p_availability_factor numeric default null,
  p_reason_code text default null,
  p_actor_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reactor public.tile_entities%rowtype;
  v_existing_event public.simulation_events%rowtype;
  v_existing_state public.entity_states%rowtype;
  v_previous_properties jsonb;
  v_mode text;
  v_factor numeric;
  v_reason text;
  v_request jsonb;
  v_properties jsonb;
  v_event_id uuid;
  v_state_id uuid;
  v_now timestamptz;
  v_canonical_event_id text;
begin
  if p_command_id is null or p_tile_entity_id is null or p_mode is null then
    raise exception 'NOXIA_REACTOR_RUNTIME_ARGUMENT_REQUIRED' using errcode = 'P0001';
  end if;

  v_mode := lower(trim(p_mode));
  v_reason := nullif(lower(trim(coalesce(p_reason_code, ''))), '');

  if v_mode not in ('unknown', 'online', 'derated', 'offline') then
    raise exception 'NOXIA_REACTOR_RUNTIME_MODE_INVALID' using errcode = 'P0001';
  end if;

  if v_reason is not null and (
    length(v_reason) > 64
    or v_reason !~ '^[a-z0-9][a-z0-9_:\.-]*$'
  ) then
    raise exception 'NOXIA_REACTOR_RUNTIME_REASON_INVALID' using errcode = 'P0001';
  end if;

  v_factor := case
    when v_mode = 'online' then 1::numeric
    when v_mode = 'offline' then 0::numeric
    when v_mode = 'derated' then p_availability_factor
    else null::numeric
  end;

  if v_mode = 'unknown' and p_availability_factor is not null then
    raise exception 'NOXIA_REACTOR_RUNTIME_FACTOR_MUST_BE_NULL' using errcode = 'P0001';
  end if;

  if v_mode = 'online' and p_availability_factor is not null and p_availability_factor <> 1 then
    raise exception 'NOXIA_REACTOR_RUNTIME_ONLINE_FACTOR_INVALID' using errcode = 'P0001';
  end if;

  if v_mode = 'offline' and p_availability_factor is not null and p_availability_factor <> 0 then
    raise exception 'NOXIA_REACTOR_RUNTIME_OFFLINE_FACTOR_INVALID' using errcode = 'P0001';
  end if;

  if v_mode = 'derated' and (v_factor is null or v_factor <= 0 or v_factor >= 1) then
    raise exception 'NOXIA_REACTOR_RUNTIME_DERATING_INVALID' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('noxia_set_reactor_runtime:command:' || p_command_id::text, 0)
  );

  v_request := jsonb_build_object(
    'tileEntityId', p_tile_entity_id,
    'mode', v_mode,
    'availabilityFactor', to_jsonb(v_factor),
    'reasonCode', v_reason,
    'actorId', p_actor_id
  );
  v_canonical_event_id := 'reactor.runtime.changed:' || p_command_id::text;

  select * into v_existing_event
  from public.simulation_events
  where canonical_event_id = v_canonical_event_id
  order by created_at asc
  limit 1;

  if found then
    if v_existing_event.subject_type is distinct from 'reactor_runtime'
      or v_existing_event.subject_id is distinct from p_tile_entity_id
      or (v_existing_event.metadata -> 'request') is distinct from v_request then
      raise exception 'NOXIA_REACTOR_RUNTIME_COMMAND_CONFLICT' using errcode = 'P0001';
    end if;

    select * into v_existing_state
    from public.entity_states
    where subject_type = 'reactor_runtime'
      and subject_id = p_tile_entity_id
      and source_event = v_existing_event.id
    order by created_at desc
    limit 1;

    if not found then
      raise exception 'NOXIA_REACTOR_RUNTIME_IDEMPOTENCY_STATE_MISSING' using errcode = 'P0001';
    end if;

    return jsonb_build_object(
      'idempotent', true,
      'eventId', v_existing_event.id,
      'stateId', v_existing_state.id,
      'tileEntityId', p_tile_entity_id,
      'state', v_existing_state.properties
    );
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('noxia_set_reactor_runtime:reactor:' || p_tile_entity_id::text, 0)
  );

  select * into v_reactor
  from public.tile_entities
  where id = p_tile_entity_id
    and entity_type = 'building'
    and entity_id = 'reactor_module'
  for share;

  if not found then
    raise exception 'NOXIA_REACTOR_RUNTIME_REACTOR_NOT_FOUND' using errcode = 'P0001';
  end if;

  select properties into v_previous_properties
  from public.entity_states
  where subject_type = 'reactor_runtime'
    and subject_id = p_tile_entity_id
    and valid_to is null
  order by valid_from desc
  limit 1
  for update;

  v_properties := jsonb_build_object(
    'schemaVersion', 1,
    'mode', v_mode,
    'availabilityFactor', to_jsonb(v_factor),
    'reasonCode', v_reason
  );

  v_now := clock_timestamp();

  insert into public.simulation_events(
    event_type,
    subject_type,
    subject_id,
    actor_id,
    location_id,
    effect_group_id,
    effects,
    metadata,
    occurred_at,
    canonical_entity_id,
    canonical_event_id
  ) values (
    'reactor.runtime.changed',
    'reactor_runtime',
    p_tile_entity_id,
    p_actor_id,
    v_reactor.location_id,
    p_command_id,
    jsonb_build_array(jsonb_build_object(
      'type', 'reactor_runtime_state',
      'from', v_previous_properties,
      'to', v_properties
    )),
    jsonb_build_object(
      'source', 'reactor_runtime_command',
      'commandId', p_command_id,
      'request', v_request
    ),
    v_now,
    'tile_entity:' || p_tile_entity_id::text,
    v_canonical_event_id
  ) returning id into v_event_id;

  update public.entity_states
  set valid_to = v_now
  where subject_type = 'reactor_runtime'
    and subject_id = p_tile_entity_id
    and valid_to is null;

  insert into public.entity_states(
    subject_type,
    subject_id,
    valid_from,
    properties,
    source_event,
    canonical_entity_id,
    canonical_state_id
  ) values (
    'reactor_runtime',
    p_tile_entity_id,
    v_now,
    v_properties,
    v_event_id,
    'tile_entity:' || p_tile_entity_id::text,
    'reactor_runtime:' || p_tile_entity_id::text || ':' || p_command_id::text
  ) returning id into v_state_id;

  return jsonb_build_object(
    'idempotent', false,
    'eventId', v_event_id,
    'stateId', v_state_id,
    'tileEntityId', p_tile_entity_id,
    'state', v_properties
  );
end;
$$;

comment on function public.noxia_set_reactor_runtime(uuid, uuid, text, numeric, text, uuid) is
  'E2a server-only reactor runtime command. Atomically appends reactor.runtime.changed and projects current reactor_runtime state. Stores mode/availability factor only; MW remains derived.';

revoke all on function public.noxia_set_reactor_runtime(uuid, uuid, text, numeric, text, uuid) from public;
revoke all on function public.noxia_set_reactor_runtime(uuid, uuid, text, numeric, text, uuid) from anon;
revoke all on function public.noxia_set_reactor_runtime(uuid, uuid, text, numeric, text, uuid) from authenticated;
grant execute on function public.noxia_set_reactor_runtime(uuid, uuid, text, numeric, text, uuid) to service_role;
