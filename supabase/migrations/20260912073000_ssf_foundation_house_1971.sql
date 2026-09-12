-- Refine the already-provisioned SSF headquarters into the historically specific
-- Foundation House described by the original 1971 building plans. This remains a
-- curated world object and never enters the normal player build catalogue.
do $$
declare
  v_location uuid;
  v_entity uuid;
begin
  select id into v_location
  from public.locations
  where slug = 'earth'
  limit 1;

  if v_location is null then
    raise exception 'Earth location not found';
  end if;

  select id into v_entity
  from public.tile_entities
  where location_id = v_location
    and entity_type = 'building'
    and entity_id = 'ssf_headquarters_sundern'
  order by id
  limit 1;

  if v_entity is null then
    raise exception 'SSF headquarters world entity not found; apply 20260909213000_world_unique_objects_ssf_headquarters.sql first';
  end if;

  -- The existing geodetic placement and world rotation at Bogenstraße 15 are retained.
  -- The corrected 90-degree relationship between house entrance and garage is encoded
  -- inside the dedicated SVG asset, not by rotating the complete site in world space.
  update public.tile_entities
  set placement_mode = 'world',
      status = 'active',
      rotation_deg = coalesce(rotation_deg, 0),
      footprint_width_m = 18,
      footprint_depth_m = 12,
      spatial_region_id = 'earth-sauerland'
  where id = v_entity;

  update public.world_unique_objects
  set tile_entity_id = v_entity,
      object_kind = 'building',
      display_name = 'Solar Science Foundation · Foundation House',
      valid_from_year = 1971,
      valid_to_year = null,
      is_enterable = true,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'role', 'foundation_headquarters',
        'institution_scale', 'small_administration',
        'building_form', '1971_bungalow_with_detached_garage',
        'built_year', 1971,
        'address', 'Bogenstraße 15, 59846 Sundern',
        'region', 'earth-sauerland',
        'canonical', true,
        'unique_world_object', true,
        'player_buildable', false,
        'replaceable', false,
        'heritage_preservation', true,
        'research_complex', false,
        'earth_role', 'administration_knowledge_coordination_and_funding',
        'visual_asset', '/assets/buildings/ssf_headquarters_sundern/earth/style-anchor.svg',
        'plan_geometry', jsonb_build_object(
          'garage', 'detached',
          'garage_gap_m_approx', 1,
          'garage_position', 'along_long_house_side_extending_rearward',
          'entrance', 'house_side_facing_garage'
        ),
        'description', 'Kleines, 1971 errichtetes Wohnhaus und späterer Verwaltungs- und Gründungsort der Solar Science Foundation. Die SSF sammelt und vermittelt Wissen und koordiniert Förderung; der Standort ist ausdrücklich kein großer Forschungscampus.'
      ),
      updated_at = now()
  where unique_key = 'ssf_headquarters_sundern';

  if not found then
    raise exception 'SSF unique world object not found; apply 20260909213000_world_unique_objects_ssf_headquarters.sql first';
  end if;

  update public.building_definitions
  set name = 'Solar Science Foundation · Foundation House',
      description = 'Einzigartiges Foundation House der SSF in der Bogenstraße 15 in Sundern. 1971 als Wohnhaus errichtet; später kleine Verwaltung, Wissensvermittlung und Förderkoordination, kein Forschungscampus.',
      category = 'unique',
      allowed_locations = array['canonical_unique']::text[],
      is_active = true
  where key = 'ssf_headquarters_sundern';
end $$;
