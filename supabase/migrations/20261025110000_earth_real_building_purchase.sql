-- supabase/migrations/20261025110000_earth_real_building_purchase.sql
-- Reale Gebäude der Erdkarte kaufen und abreißen (Thomas, 25.10.2026; Request R-12).
--
-- Regeln:
--   * Kaufen nur, was noch niemandem gehört. Das Geld geht an die Gemeinde
--     (öffentlicher Akteur des Ortes, location_public_actors) – ein Transfer
--     nach NOXIA-FIN-0001: Spieler −Preis, öffentliche Kasse +Preis.
--   * Bewohner bleiben; ihre Wohnzuweisung zeigt danach auf das gekaufte Gebäude,
--     ein Mietverhältnis bekommt den Spieler (sein Unternehmen) als Vermieter.
--   * Abreißen nur selbst gekaufter Gebäude und nur, wenn niemand darin wohnt.
--     Das Gebäude verschwindet aus tile_entities; die Karte blendet den
--     OSM-Grundriss über earth_cleared_buildings aus, die Fläche ist frei zum Bauen.
-- Preis und Maße rechnet der Server (lib/worldlab/buildingOffer.ts) aus den
-- gespeicherten OSM-Daten, nie aus Angaben des Spielers.

set search_path to public;

alter table public.tile_entities add column if not exists source_ref text;
alter table public.tile_entities add column if not exists display_name text;
create unique index if not exists tile_entities_source_ref_unique on public.tile_entities(source_ref) where source_ref is not null;

create table if not exists public.earth_cleared_buildings (
  source_ref   text primary key,
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  latitude_deg double precision not null,
  longitude_deg double precision not null,
  footprint_width_m double precision not null,
  footprint_depth_m double precision not null,
  rotation_deg double precision not null default 0,
  display_name text,
  cleared_at   timestamptz not null default now()
);
alter table public.earth_cleared_buildings enable row level security;
drop policy if exists earth_cleared_buildings_read on public.earth_cleared_buildings;
create policy earth_cleared_buildings_read on public.earth_cleared_buildings for select using (true);
grant select on public.earth_cleared_buildings to anon, authenticated;
grant all on public.earth_cleared_buildings to service_role;

insert into public.building_definitions(key, name, description, category, tier, cost_credits, build_time_ticks, population_bonus, allowed_locations, is_active, sort_order)
values ('acquired_building', 'Bestandsgebäude', 'Reales Gebäude der Erdkarte, von der Gemeinde gekauft.', 'real', 1, 0, 0, 0, array['earth'], false, 990)
on conflict (key) do nothing;

create or replace function public.buy_earth_building(
  p_profile_id uuid,
  p_source_ref text,
  p_price integer,
  p_latitude double precision,
  p_longitude double precision,
  p_width double precision,
  p_depth double precision,
  p_rotation double precision,
  p_display_name text,
  p_region_slug text,
  p_x_m double precision,
  p_y_m double precision,
  p_residential_capacity integer,
  p_feature_ids uuid[]
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_credits integer;
  v_location_id uuid;
  v_public_actor uuid;
  v_tick bigint;
  v_entity_id uuid;
  v_landlord uuid;
  v_moved integer := 0;
begin
  if p_price is null or p_price < 1 then raise exception 'NOXIA_PRICE_INVALID'; end if;
  if p_source_ref is null or p_source_ref !~ '^osm:(way|relation):[0-9]+$' then raise exception 'NOXIA_SOURCE_INVALID'; end if;

  select credits into v_credits from public.profiles where id = p_profile_id for update;
  if not found then raise exception 'NOXIA_PROFILE_NOT_FOUND'; end if;

  if exists (select 1 from public.tile_entities where source_ref = p_source_ref) then raise exception 'NOXIA_BUILDING_OWNED'; end if;
  if exists (select 1 from public.earth_cleared_buildings where source_ref = p_source_ref) then raise exception 'NOXIA_BUILDING_CLEARED'; end if;
  if v_credits < p_price then raise exception 'NOXIA_CREDITS_INSUFFICIENT'; end if;

  select id into v_location_id from public.locations where slug = 'earth';
  select actor_id into v_public_actor from public.location_public_actors where location_id = v_location_id;
  if v_public_actor is null then raise exception 'NOXIA_PUBLIC_ACTOR_MISSING'; end if;
  select coalesce(max(tick_number), 0)::bigint into v_tick from public.tick_log;

  -- Transfer: Spieler → Gemeinde
  update public.profiles set credits = credits - p_price where id = p_profile_id;
  insert into public.npc_ledger(actor_id, tick, kind, resource, goods_delta, credit_delta, location_id, ref, note)
  values (v_public_actor, v_tick, 'income', null, 0, p_price, v_location_id,
          'building_purchase:' || p_source_ref || ':player:' || p_profile_id::text,
          left('Verkauf eines Gebäudes an einen Spieler: ' || coalesce(p_display_name, p_source_ref), 240));

  insert into public.tile_entities(
    profile_id, location_id, entity_type, entity_id, owner_class, owner_id, status,
    placement_mode, x_m, y_m, latitude_deg, longitude_deg, spatial_region_id,
    rotation_deg, footprint_width_m, footprint_depth_m, residential_capacity,
    source_ref, display_name
  ) values (
    p_profile_id, v_location_id, 'building', 'acquired_building', 'PLAYER', p_profile_id, 'active',
    'world', p_x_m, p_y_m, p_latitude, p_longitude, p_region_slug,
    coalesce(p_rotation, 0), p_width, p_depth, greatest(0, coalesce(p_residential_capacity, 0)),
    p_source_ref, left(p_display_name, 120)
  ) returning id into v_entity_id;

  -- Bewohner bleiben: Wohnzuweisungen zeigen auf das gekaufte Gebäude.
  if p_feature_ids is not null and array_length(p_feature_ids, 1) > 0 then
    update public.person_assignments
       set tile_entity_id = v_entity_id, updated_at = now()
     where is_active and assignment_type = 'home' and region_feature_id = any(p_feature_ids);
    get diagnostics v_moved = row_count;
    select id into v_landlord from public.actors where kind = 'player_corp' and founded_by = p_profile_id order by created_at limit 1;
    update public.person_tenancies t
       set tile_entity_id = v_entity_id, landlord_actor_id = coalesce(v_landlord, t.landlord_actor_id), updated_at = now()
      from public.person_assignments a
     where a.tile_entity_id = v_entity_id and a.is_active and a.assignment_type = 'home'
       and t.person_id = a.person_id and t.status in ('active', 'provided');
  end if;

  return jsonb_build_object('ok', true, 'entity_id', v_entity_id, 'price', p_price, 'credits', v_credits - p_price, 'residents', v_moved, 'seller_actor_id', v_public_actor);
end;
$$;

create or replace function public.demolish_earth_building(p_profile_id uuid, p_entity_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.tile_entities%rowtype;
begin
  select * into v_row from public.tile_entities where id = p_entity_id for update;
  if not found then raise exception 'NOXIA_BUILDING_NOT_FOUND'; end if;
  if v_row.profile_id is distinct from p_profile_id then raise exception 'NOXIA_BUILDING_NOT_OWNED'; end if;
  if v_row.source_ref is null then raise exception 'NOXIA_BUILDING_NOT_ACQUIRED'; end if;
  if exists (select 1 from public.person_assignments where tile_entity_id = p_entity_id and is_active) then raise exception 'NOXIA_BUILDING_INHABITED'; end if;

  insert into public.earth_cleared_buildings(source_ref, profile_id, latitude_deg, longitude_deg, footprint_width_m, footprint_depth_m, rotation_deg, display_name)
  values (v_row.source_ref, p_profile_id, v_row.latitude_deg, v_row.longitude_deg, v_row.footprint_width_m, v_row.footprint_depth_m, v_row.rotation_deg, v_row.display_name);
  delete from public.tile_entities where id = p_entity_id;
  return jsonb_build_object('ok', true, 'source_ref', v_row.source_ref, 'latitude', v_row.latitude_deg, 'longitude', v_row.longitude_deg,
    'width', v_row.footprint_width_m, 'depth', v_row.footprint_depth_m, 'rotation', v_row.rotation_deg);
end;
$$;

revoke all on function public.buy_earth_building(uuid,text,integer,double precision,double precision,double precision,double precision,double precision,text,text,double precision,double precision,integer,uuid[]) from public, anon, authenticated;
grant execute on function public.buy_earth_building(uuid,text,integer,double precision,double precision,double precision,double precision,double precision,text,text,double precision,double precision,integer,uuid[]) to service_role;
revoke all on function public.demolish_earth_building(uuid,uuid) from public, anon, authenticated;
grant execute on function public.demolish_earth_building(uuid,uuid) to service_role;
