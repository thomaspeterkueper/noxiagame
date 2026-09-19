-- NOXIA Core: minimal authoritative player crew manifest for spacecraft operations.
--
-- This table represents gameplay crew presence only. It does not replace the
-- Living Population person/assignment model. A player profile may explicitly
-- board their own spacecraft as commander/pilot, which is sufficient for the
-- first player-controlled ascent slice.

create table if not exists public.ship_crew_manifest (
  ship_id uuid not null references public.ships(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'commander',
  active boolean not null default true,
  boarded_at timestamptz not null default now(),
  left_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (ship_id, profile_id),
  constraint ship_crew_manifest_role_check check (role in ('commander','pilot','crew')),
  constraint ship_crew_manifest_active_dates_check check (
    (active and left_at is null) or (not active)
  )
);

create index if not exists ship_crew_manifest_profile_idx
  on public.ship_crew_manifest(profile_id, active);

alter table public.ship_crew_manifest enable row level security;
revoke all on table public.ship_crew_manifest from public, anon, authenticated;
grant select, insert, update, delete on table public.ship_crew_manifest to service_role;

create or replace function public.noxia_board_player_crew(
  p_profile_id uuid,
  p_ship_id uuid,
  p_role text default 'commander'
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_ship public.ships%rowtype;
  v_row public.ship_crew_manifest%rowtype;
begin
  if p_role not in ('commander','pilot','crew') then
    raise exception 'NOXIA_CREW_INVALID_ROLE' using errcode = 'P0001';
  end if;

  select * into v_ship from public.ships where id = p_ship_id for update;
  if not found then raise exception 'NOXIA_CREW_SHIP_NOT_FOUND' using errcode = 'P0001'; end if;
  if v_ship.profile_id <> p_profile_id then raise exception 'NOXIA_CREW_FORBIDDEN' using errcode = 'P0001'; end if;
  if v_ship.status = 'transit' then raise exception 'NOXIA_CREW_SHIP_IN_TRANSIT' using errcode = 'P0001'; end if;

  insert into public.ship_crew_manifest(ship_id, profile_id, role, active, boarded_at, left_at, updated_at)
  values (p_ship_id, p_profile_id, p_role, true, now(), null, now())
  on conflict (ship_id, profile_id) do update set
    role = excluded.role,
    active = true,
    boarded_at = case when public.ship_crew_manifest.active then public.ship_crew_manifest.boarded_at else now() end,
    left_at = null,
    updated_at = now()
  returning * into v_row;

  return jsonb_build_object(
    'shipId', v_row.ship_id,
    'profileId', v_row.profile_id,
    'role', v_row.role,
    'active', v_row.active,
    'boardedAt', v_row.boarded_at
  );
end;
$function$;

create or replace function public.noxia_leave_player_crew(
  p_profile_id uuid,
  p_ship_id uuid
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_ship public.ships%rowtype;
  v_row public.ship_crew_manifest%rowtype;
begin
  select * into v_ship from public.ships where id = p_ship_id for update;
  if not found then raise exception 'NOXIA_CREW_SHIP_NOT_FOUND' using errcode = 'P0001'; end if;
  if v_ship.profile_id <> p_profile_id then raise exception 'NOXIA_CREW_FORBIDDEN' using errcode = 'P0001'; end if;
  if v_ship.status = 'transit' then raise exception 'NOXIA_CREW_SHIP_IN_TRANSIT' using errcode = 'P0001'; end if;

  update public.ship_crew_manifest
     set active = false, left_at = now(), updated_at = now()
   where ship_id = p_ship_id and profile_id = p_profile_id
   returning * into v_row;

  if not found then
    return jsonb_build_object('shipId', p_ship_id, 'profileId', p_profile_id, 'active', false, 'idempotent', true);
  end if;

  return jsonb_build_object(
    'shipId', v_row.ship_id,
    'profileId', v_row.profile_id,
    'role', v_row.role,
    'active', false,
    'leftAt', v_row.left_at,
    'idempotent', false
  );
end;
$function$;

revoke all on function public.noxia_board_player_crew(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.noxia_leave_player_crew(uuid,uuid) from public, anon, authenticated;
grant execute on function public.noxia_board_player_crew(uuid,uuid,text) to service_role;
grant execute on function public.noxia_leave_player_crew(uuid,uuid) to service_role;
