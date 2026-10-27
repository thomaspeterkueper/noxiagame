-- Mishkan Avi – sehr kleine Siedlung am Rand der Melas Chasma (Valles Marineris).
-- Entwurf: docs/worldbuilding/mishkan-avi.md. Name von Thomas (27.10.2026).
--
-- Erster Ort, der über den allgemeinen Weg für Mars-Oberflächenorte läuft
-- (lib/game/locationBody.ts): kein Slug im Code, Körper aus celestial_body_id,
-- Reise über die Marsbahn, Darstellung über die gemeinsame Mars-Ansicht.
--
-- Ohne Bewohner und ohne Simulation (simulate_tick = false), bis Bewohner,
-- Zereya und Soraya in einem eigenen Schritt angelegt werden.

set search_path to public;

begin;

-- 1. Ort --------------------------------------------------------------------
insert into public.locations
  (slug, name, description, population, population_max, has_shipyard, location_type,
   celestial_body_id, surface_lat, surface_lon, grid_radius, is_public, simulate_tick, is_supplied)
values
  ('mishkan-avi', 'Mishkan Avi',
   'Kleine, stille Siedlung am Rand der Melas Chasma im Valles Marineris. Landeplatz, ein Habitat, Verwaltung und eine Hafenkantine mit Automat.',
   0, 60, false, 'colony',
   '10000000-0000-0000-0000-000000000004', -10.5, -72.5, 8, true, false, true)
on conflict (slug) do nothing;

-- 2. Weltrahmen auf dem gemeinsamen Mars-Datensatz (MOLA) -------------------
insert into public.world_frames
  (location_id, body, world_seed, coordinate_system, reference_frame, latitude_type,
   longitude_direction, equatorial_radius_m, polar_radius_m, vertical_datum,
   terrain_dataset_id, origin_lat_deg, origin_lon_deg, origin_alt_m, origin_status,
   observed_source, derived_config)
select l.id, 'mars', 'NOXIA:MARS:MISHKAN-AVI:V1', 'LOCAL_ENU_METERS', 'IAU_MARS_ELLIPSOID', 'planetocentric',
       'positive_east', 3396190, 3376200, 'MOLA_GMM2B_AREOID',
       'mars_mgs_mola_463m', -10.5, -72.5, 0, 'derived',
       jsonb_build_object(
         'provenance','derived',
         'anchor_source','locations.surface_lat/surface_lon',
         'feature_reference_name','Melas Chasma',
         'feature_reference_role','IAU/USGS named feature (Valles Marineris); site on the chasma rim is a NOXIA choice, not a surveyed landing site',
         'local_anchor_selected_at','2026-10-27'),
       jsonb_build_object(
         'provenance','derived','generator','noxia-spatial-v1',
         'origin_alt_semantics','datum_zero_plane',
         'terrain_vertical_reference','MOLA_GMM2B_AREOID',
         'visual_language','mars_outpost_minimal')
from public.locations l
where l.slug = 'mishkan-avi'
on conflict (location_id) do nothing;

-- 3. Öffentliches Konto und Koloniekasse (Steuersätze 0, wie Phobos) --------
do $$
declare
  v_location uuid;
  v_actor uuid;
begin
  select id into v_location from public.locations where slug = 'mishkan-avi';
  if v_location is null then return; end if;

  if not exists (select 1 from public.location_public_actors where location_id = v_location) then
    insert into public.actors(kind, display_name, bio_short, personality, decision_weights)
    values ('institution', 'Mishkan Avi – Öffentliche Dienste',
            'Öffentlicher Arbeitgeber und Budgetträger der lokalen Infrastruktur.', '{}'::jsonb, '{}'::jsonb)
    returning id into v_actor;
    insert into public.location_public_actors(location_id, actor_id) values (v_location, v_actor);
  end if;

  insert into public.colony_settings(location_id) values (v_location)
  on conflict (location_id) do nothing;
end $$;

-- 4. Gebäude: Landeplatz, Habitat, Verwaltung (staatlich) --------------------
with site as (
  select id from public.locations where slug = 'mishkan-avi'
), seed(entity_id, x_m, y_m, rotation_deg, footprint_width_m, footprint_depth_m) as (
  values
    ('landing_pad', 34.0, -10.0, 12.0, 30.0, 30.0),
    ('habitat',    -14.0,   6.0,  4.0, 18.0, 14.0),
    ('admin',        6.0,  14.0,  4.0, 12.0, 10.0)
)
insert into public.tile_entities
  (profile_id, location_id, entity_type, entity_id, owner_class, owner_id, is_state_owned,
   placement_mode, x_m, y_m, rotation_deg, footprint_width_m, footprint_depth_m,
   spatial_region_id, terrain_dataset_id, terrain_status, status, condition)
select null, s.id, 'building', d.entity_id, 'STATE', null, true,
       'world', d.x_m, d.y_m, d.rotation_deg, d.footprint_width_m, d.footprint_depth_m,
       'mishkan-avi-alpha', 'mars_mgs_mola_463m', 'unresolved', 'active', 100
from site s cross join seed d
where not exists (
  select 1 from public.tile_entities te
  where te.location_id = s.id and te.entity_type = 'building' and te.entity_id = d.entity_id
    and te.parent_id is null
);

-- 5. Hafenkantine mit Automat im Landeplatz (NOXIA-LIVING-0013) -------------
insert into public.tile_entities
  (location_id, parent_id, slot, entity_type, entity_id, status, is_state_owned, owner_class)
select te.location_id, te.id,
       coalesce((select max(c.slot) from public.tile_entities c where c.parent_id = te.id), 0) + 1,
       'building', 'port_canteen', 'active', true, 'STATE'
from public.tile_entities te
join public.locations l on l.id = te.location_id
where l.slug = 'mishkan-avi' and te.entity_id = 'landing_pad' and te.parent_id is null and te.status = 'active'
  and not exists (
    select 1 from public.tile_entities k
    where k.location_id = te.location_id and k.entity_id = 'port_canteen' and k.status = 'active'
  );

commit;
