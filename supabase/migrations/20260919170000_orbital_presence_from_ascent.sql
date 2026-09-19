-- Shared NOXIA Core: authoritative orbital presence after completed ascent.
--
-- This is intentionally separate from ascent mission persistence. Reaching an
-- orbital node is not docking, and the legacy ships.status enum must not be
-- overloaded with a fabricated surface/transit meaning.

create table if not exists public.orbital_presence (
  ship_id uuid primary key references public.ships(id) on delete cascade,
  actor_profile_id uuid not null references public.profiles(id) on delete cascade,
  orbit_node_slug text not null,
  body_slug text not null,
  source_ascent_mission_id uuid not null unique references public.ascent_missions(id) on delete restrict,
  entered_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orbital_presence_orbit_nonempty check (length(btrim(orbit_node_slug)) > 0),
  constraint orbital_presence_body_nonempty check (length(btrim(body_slug)) > 0)
);

alter table public.orbital_presence enable row level security;
revoke all on table public.orbital_presence from public, anon, authenticated;
grant select, insert, update, delete on table public.orbital_presence to service_role;

create index if not exists orbital_presence_actor_idx
  on public.orbital_presence(actor_profile_id, updated_at desc);
create index if not exists orbital_presence_node_idx
  on public.orbital_presence(orbit_node_slug, updated_at desc);

create or replace function public.noxia_settle_ascent_orbital_presence(
  p_actor_profile_id uuid,
  p_mission_id uuid,
  p_body_slug text
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_mission public.ascent_missions%rowtype;
  v_existing public.orbital_presence%rowtype;
  v_result jsonb;
begin
  if nullif(btrim(p_body_slug), '') is null then
    raise exception 'NOXIA_ORBITAL_PRESENCE_INVALID_BODY' using errcode = 'P0001';
  end if;

  select * into v_mission
    from public.ascent_missions
   where id = p_mission_id;

  if not found then
    raise exception 'NOXIA_ASCENT_MISSION_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_mission.actor_profile_id <> p_actor_profile_id then
    raise exception 'NOXIA_ASCENT_FORBIDDEN' using errcode = 'P0001';
  end if;
  if v_mission.phase <> 'orbital-arrival' or v_mission.status <> 'completed' then
    raise exception 'NOXIA_ASCENT_NOT_AT_ORBITAL_ARRIVAL' using errcode = 'P0001';
  end if;

  select * into v_existing
    from public.orbital_presence
   where source_ascent_mission_id = p_mission_id;

  if found then
    return jsonb_build_object(
      'shipId', v_existing.ship_id,
      'orbitNodeSlug', v_existing.orbit_node_slug,
      'bodySlug', v_existing.body_slug,
      'sourceAscentMissionId', v_existing.source_ascent_mission_id,
      'enteredAt', v_existing.entered_at,
      'idempotent', true
    );
  end if;

  insert into public.orbital_presence(
    ship_id,
    actor_profile_id,
    orbit_node_slug,
    body_slug,
    source_ascent_mission_id
  ) values (
    v_mission.ship_id,
    p_actor_profile_id,
    lower(v_mission.target_orbit_node_slug),
    lower(p_body_slug),
    v_mission.id
  )
  on conflict (ship_id) do update set
    actor_profile_id = excluded.actor_profile_id,
    orbit_node_slug = excluded.orbit_node_slug,
    body_slug = excluded.body_slug,
    source_ascent_mission_id = excluded.source_ascent_mission_id,
    entered_at = now(),
    updated_at = now()
  returning * into v_existing;

  v_result := jsonb_build_object(
    'shipId', v_existing.ship_id,
    'orbitNodeSlug', v_existing.orbit_node_slug,
    'bodySlug', v_existing.body_slug,
    'sourceAscentMissionId', v_existing.source_ascent_mission_id,
    'enteredAt', v_existing.entered_at,
    'idempotent', false
  );

  return v_result;
end;
$function$;

revoke all on function public.noxia_settle_ascent_orbital_presence(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.noxia_settle_ascent_orbital_presence(uuid,uuid,text) to service_role;
