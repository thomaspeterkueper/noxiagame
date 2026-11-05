-- Schiff mit angeheuertem Piloten losschicken, ohne selbst an Bord zu sein.
-- Baut auf 20261103190000_ship_parking_aboard.sql auf (profiles.aboard_ship_id).
--
-- noxia_aboard_ship_id kennt eine transaktionslokale Einstellung 'noxia.dispatch_ship':
-- Nur innerhalb von noxia_dispatch_ship gesetzt, damit noxia_start_transit_with_pilot
-- (Energie, Landegebuehr, Landeplatz, Honorar) unveraendert fuer das Schiff gilt.

create or replace function public.noxia_aboard_ship_id(p_profile_id uuid)
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select s.id
  from public.ships s
  where s.profile_id = p_profile_id
    and s.id = coalesce(
      nullif(current_setting('noxia.dispatch_ship', true), '')::uuid,
      (select p.aboard_ship_id from public.profiles p where p.id = p_profile_id)
    )
$$;

create or replace function public.noxia_dispatch_ship(
  p_profile_id uuid,
  p_ship_id uuid,
  p_destination_slug text,
  p_duration_seconds integer,
  p_energy_needed integer,
  p_docking_idle_hours integer default 24,
  p_pilot_fee integer default 0
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_profile public.profiles%rowtype;
  v_ship public.ships%rowtype;
  v_result jsonb;
begin
  select * into v_profile from public.profiles where id = p_profile_id for update;
  if not found then raise exception 'NOXIA_PROFILE_NOT_FOUND' using errcode = 'P0001'; end if;
  select * into v_ship from public.ships where id = p_ship_id and profile_id = p_profile_id for update;
  if not found then raise exception 'NOXIA_SHIP_NOT_FOUND' using errcode = 'P0001'; end if;
  if v_profile.aboard_ship_id is not distinct from v_ship.id then
    raise exception 'NOXIA_DISPATCH_PLAYER_ABOARD' using errcode = 'P0001';
  end if;
  if v_ship.status = 'transit'::public.ship_status then
    raise exception 'NOXIA_SHIP_IN_TRANSIT' using errcode = 'P0001';
  end if;
  if v_profile.transit_destination is not null and v_profile.transit_arrives_at > now() then
    raise exception 'NOXIA_TRANSIT_ALREADY_ACTIVE:%', v_profile.transit_destination using errcode = 'P0001';
  end if;
  if v_ship.location is distinct from v_profile.current_location then
    raise exception 'NOXIA_SHIP_NOT_HERE:%', v_ship.location using errcode = 'P0001';
  end if;

  perform set_config('noxia.dispatch_ship', v_ship.id::text, true);
  v_result := public.noxia_start_transit_with_pilot(
    p_profile_id, p_destination_slug, p_duration_seconds, p_energy_needed, p_docking_idle_hours, p_pilot_fee);
  perform set_config('noxia.dispatch_ship', '', true);

  return v_result || jsonb_build_object('dispatched', true);
end;
$$;

revoke all on function public.noxia_dispatch_ship(uuid, uuid, text, integer, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.noxia_dispatch_ship(uuid, uuid, text, integer, integer, integer, integer) to service_role;
