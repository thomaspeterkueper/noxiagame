-- Shared NOXIA Core: persistent surface-to-orbit ascent state.
--
-- Physics is deliberately not encoded here. Engineering authority is stored only as
-- an opaque, versioned reference supplied by trusted server-side orchestration.
-- Public gameplay APIs must fail closed until that resolver exists.

create table if not exists public.ascent_missions (
  id uuid primary key default gen_random_uuid(),
  ship_id uuid not null references public.ships(id) on delete cascade,
  actor_profile_id uuid not null references public.profiles(id) on delete cascade,
  departure_surface_slug text not null,
  target_orbit_node_slug text not null,
  engineering_authority_ref text not null,
  phase text not null default 'ascent-authorized',
  status text not null default 'active',
  authorized_at timestamptz not null default now(),
  started_at timestamptz,
  insertion_at timestamptz,
  arrived_at timestamptz,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ascent_missions_phase_check check (
    phase = any (array['surface','ascent-authorized','ascending','orbital-insertion','orbital-arrival']::text[])
  ),
  constraint ascent_missions_status_check check (
    status = any (array['active','completed','cancelled']::text[])
  ),
  constraint ascent_missions_authority_nonempty check (length(btrim(engineering_authority_ref)) > 0),
  constraint ascent_missions_departure_nonempty check (length(btrim(departure_surface_slug)) > 0),
  constraint ascent_missions_target_nonempty check (length(btrim(target_orbit_node_slug)) > 0)
);

create table if not exists public.ascent_commands (
  command_id uuid primary key,
  action text not null,
  actor_profile_id uuid not null references public.profiles(id) on delete cascade,
  ship_id uuid not null references public.ships(id) on delete cascade,
  mission_id uuid references public.ascent_missions(id) on delete cascade,
  departure_surface_slug text,
  target_orbit_node_slug text,
  engineering_authority_ref text,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint ascent_commands_action_check check (
    action = any (array['authorize','cancel','start','mark_insertion','mark_arrival']::text[])
  )
);

create unique index if not exists ascent_missions_active_ship_uidx
  on public.ascent_missions(ship_id) where status = 'active';
create index if not exists ascent_missions_actor_idx on public.ascent_missions(actor_profile_id, created_at desc);
create index if not exists ascent_missions_target_idx on public.ascent_missions(target_orbit_node_slug, created_at desc);

alter table public.ascent_missions enable row level security;
alter table public.ascent_commands enable row level security;

revoke all on table public.ascent_missions from public, anon, authenticated;
revoke all on table public.ascent_commands from public, anon, authenticated;
grant select, insert, update, delete on table public.ascent_missions to service_role;
grant select, insert, update, delete on table public.ascent_commands to service_role;

create or replace function public.noxia_authorize_ascent(
  p_command_id uuid,
  p_actor_profile_id uuid,
  p_ship_id uuid,
  p_departure_surface_slug text,
  p_target_orbit_node_slug text,
  p_engineering_authority_ref text
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_existing public.ascent_commands%rowtype;
  v_ship public.ships%rowtype;
  v_mission public.ascent_missions%rowtype;
  v_result jsonb;
begin
  if nullif(btrim(p_departure_surface_slug), '') is null
     or nullif(btrim(p_target_orbit_node_slug), '') is null
     or nullif(btrim(p_engineering_authority_ref), '') is null then
    raise exception 'NOXIA_ASCENT_INVALID_AUTHORITY' using errcode = 'P0001';
  end if;

  select * into v_existing from public.ascent_commands where command_id = p_command_id;
  if found then
    if v_existing.action <> 'authorize'
       or v_existing.actor_profile_id <> p_actor_profile_id
       or v_existing.ship_id <> p_ship_id
       or v_existing.departure_surface_slug <> p_departure_surface_slug
       or v_existing.target_orbit_node_slug <> p_target_orbit_node_slug
       or v_existing.engineering_authority_ref <> p_engineering_authority_ref then
      raise exception 'NOXIA_ASCENT_COMMAND_CONFLICT' using errcode = 'P0001';
    end if;
    return v_existing.result || jsonb_build_object('idempotent', true);
  end if;

  select * into v_ship from public.ships where id = p_ship_id for update;
  if not found then raise exception 'NOXIA_ASCENT_SHIP_NOT_FOUND' using errcode = 'P0001'; end if;
  if v_ship.profile_id <> p_actor_profile_id then raise exception 'NOXIA_ASCENT_FORBIDDEN' using errcode = 'P0001'; end if;
  if lower(coalesce(v_ship.location, '')) <> lower(p_departure_surface_slug) then
    raise exception 'NOXIA_ASCENT_NOT_ON_DEPARTURE_SURFACE' using errcode = 'P0001';
  end if;
  if exists(select 1 from public.docking_connections where ship_id = p_ship_id and status = 'docked') then
    raise exception 'NOXIA_ASCENT_ACTIVE_DOCKING_CONNECTION' using errcode = 'P0001';
  end if;
  if exists(select 1 from public.ascent_missions where ship_id = p_ship_id and status = 'active') then
    raise exception 'NOXIA_ASCENT_CONFLICTING_MISSION' using errcode = 'P0001';
  end if;

  insert into public.ascent_missions(
    ship_id, actor_profile_id, departure_surface_slug, target_orbit_node_slug,
    engineering_authority_ref, phase, status
  ) values (
    p_ship_id, p_actor_profile_id, lower(p_departure_surface_slug), lower(p_target_orbit_node_slug),
    p_engineering_authority_ref, 'ascent-authorized', 'active'
  ) returning * into v_mission;

  v_result := jsonb_build_object(
    'missionId', v_mission.id,
    'shipId', p_ship_id,
    'phase', v_mission.phase,
    'status', v_mission.status,
    'departureSurfaceSlug', v_mission.departure_surface_slug,
    'targetOrbitNodeSlug', v_mission.target_orbit_node_slug,
    'engineeringAuthorityRef', v_mission.engineering_authority_ref,
    'idempotent', false
  );

  insert into public.ascent_commands(
    command_id, action, actor_profile_id, ship_id, mission_id,
    departure_surface_slug, target_orbit_node_slug, engineering_authority_ref, result
  ) values (
    p_command_id, 'authorize', p_actor_profile_id, p_ship_id, v_mission.id,
    p_departure_surface_slug, p_target_orbit_node_slug, p_engineering_authority_ref, v_result
  );
  return v_result;
end;
$function$;

create or replace function public.noxia_transition_ascent(
  p_command_id uuid,
  p_actor_profile_id uuid,
  p_mission_id uuid,
  p_action text
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_existing public.ascent_commands%rowtype;
  v_mission public.ascent_missions%rowtype;
  v_expected_phase text;
  v_next_phase text;
  v_next_status text := 'active';
  v_result jsonb;
begin
  if p_action not in ('cancel','start','mark_insertion','mark_arrival') then
    raise exception 'NOXIA_ASCENT_INVALID_ACTION' using errcode = 'P0001';
  end if;

  select * into v_existing from public.ascent_commands where command_id = p_command_id;
  if found then
    if v_existing.action <> p_action
       or v_existing.actor_profile_id <> p_actor_profile_id
       or v_existing.mission_id <> p_mission_id then
      raise exception 'NOXIA_ASCENT_COMMAND_CONFLICT' using errcode = 'P0001';
    end if;
    return v_existing.result || jsonb_build_object('idempotent', true);
  end if;

  select * into v_mission from public.ascent_missions where id = p_mission_id for update;
  if not found then raise exception 'NOXIA_ASCENT_MISSION_NOT_FOUND' using errcode = 'P0001'; end if;
  if v_mission.actor_profile_id <> p_actor_profile_id then raise exception 'NOXIA_ASCENT_FORBIDDEN' using errcode = 'P0001'; end if;
  if v_mission.status <> 'active' then raise exception 'NOXIA_ASCENT_MISSION_NOT_ACTIVE' using errcode = 'P0001'; end if;

  case p_action
    when 'cancel' then
      v_expected_phase := 'ascent-authorized'; v_next_phase := 'surface'; v_next_status := 'cancelled';
    when 'start' then
      v_expected_phase := 'ascent-authorized'; v_next_phase := 'ascending';
    when 'mark_insertion' then
      v_expected_phase := 'ascending'; v_next_phase := 'orbital-insertion';
    when 'mark_arrival' then
      v_expected_phase := 'orbital-insertion'; v_next_phase := 'orbital-arrival'; v_next_status := 'completed';
  end case;

  if v_mission.phase <> v_expected_phase then
    raise exception 'NOXIA_ASCENT_PHASE_CONFLICT' using errcode = 'P0001';
  end if;

  update public.ascent_missions
     set phase = v_next_phase,
         status = v_next_status,
         started_at = case when p_action = 'start' then now() else started_at end,
         insertion_at = case when p_action = 'mark_insertion' then now() else insertion_at end,
         arrived_at = case when p_action = 'mark_arrival' then now() else arrived_at end,
         settled_at = case when p_action in ('cancel','mark_arrival') then now() else settled_at end,
         updated_at = now()
   where id = p_mission_id
   returning * into v_mission;

  v_result := jsonb_build_object(
    'missionId', v_mission.id,
    'shipId', v_mission.ship_id,
    'phase', v_mission.phase,
    'status', v_mission.status,
    'targetOrbitNodeSlug', v_mission.target_orbit_node_slug,
    'arrivalControlPhase', case when v_mission.phase = 'orbital-arrival' then 'arrival-rendezvous' else null end,
    'idempotent', false
  );

  insert into public.ascent_commands(command_id, action, actor_profile_id, ship_id, mission_id, result)
  values (p_command_id, p_action, p_actor_profile_id, v_mission.ship_id, p_mission_id, v_result);
  return v_result;
end;
$function$;

revoke all on function public.noxia_authorize_ascent(uuid,uuid,uuid,text,text,text) from public, anon, authenticated;
revoke all on function public.noxia_transition_ascent(uuid,uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.noxia_authorize_ascent(uuid,uuid,uuid,text,text,text) to service_role;
grant execute on function public.noxia_transition_ascent(uuid,uuid,uuid,text) to service_role;
