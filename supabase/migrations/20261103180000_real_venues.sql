-- 20261103180000_real_venues.sql
-- Echte Lokale der Karte als volle Lokale (Thomas, 03.11.2026: „Lokale zusammenführen“).
-- Ein reales Café, eine Bar, Kneipe oder ein Restaurant aus OpenStreetMap bekommt beim
-- ersten Betreten einen Eintrag in tile_entities. Damit gibt es Karte, Bestellen, Arbeiten
-- und Begleitung wie in Metropol oder Balkan Grill.
-- Gibt es am Ort schon ein NOXIA-Lokal (gleiche OSM-Kennung oder höchstens 25 m entfernt),
-- wird es genommen. Neu angelegte Häuser:
--   * gehören dem Ort (staatlich, wie Metropol);
--   * stehen nicht als NOXIA-Haus auf der Karte (source_tags.real_venue), das reale Haus
--     bleibt, wie es ist;
--   * haben vorerst keine Stellenzahl (staff_capacity null): Bevölkerung stellt dort
--     niemanden von selbst ein (R-27). Wer laut Simulation dort arbeitet, steht hinter dem Tresen.

create or replace function public.noxia_real_venue(
  p_source_ref text, p_amenity text, p_name text, p_lat double precision, p_lon double precision,
  p_region_id text, p_width_m double precision default null, p_depth_m double precision default null, p_rotation_deg double precision default 0
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_kind text; v_earth uuid; v_id uuid; v_name text;
begin
  v_kind := case lower(coalesce(p_amenity, ''))
    when 'cafe' then 'cafe' when 'ice_cream' then 'cafe'
    when 'bar' then 'bar' when 'pub' then 'bar' when 'biergarten' then 'bar'
    when 'restaurant' then 'restaurant' when 'fast_food' then 'restaurant'
    else null end;
  if v_kind is null then raise exception 'NOXIA_REAL_VENUE_KIND'; end if;
  if p_lat is null or p_lon is null or abs(p_lat) > 90 or abs(p_lon) > 180 then raise exception 'NOXIA_REAL_VENUE_POSITION'; end if;
  if p_source_ref is null or p_source_ref !~ '^osm:(node|way|relation):[0-9]+$' then raise exception 'NOXIA_REAL_VENUE_SOURCE'; end if;
  select id into v_earth from public.locations where slug = 'earth';

  -- Vorhandenes Lokal: gleiche Kennung, sonst das nächste Lokal im Umkreis von 25 m.
  select te.id into v_id from public.tile_entities te
   where te.location_id = v_earth and te.entity_type = 'building' and te.status = 'active' and te.source_ref = p_source_ref
   limit 1;
  if v_id is null then
    select te.id into v_id from public.tile_entities te
     where te.location_id = v_earth and te.entity_type = 'building' and te.status = 'active'
       and te.entity_id in ('cafe', 'bar', 'restaurant', 'hotel', 'nightclub')
       and te.latitude_deg is not null
       and abs(te.latitude_deg - p_lat) < 0.0004 and abs(te.longitude_deg - p_lon) < 0.0006
       and sqrt(power((te.latitude_deg - p_lat) * 111195, 2) + power((te.longitude_deg - p_lon) * 111195 * cos(radians(p_lat)), 2)) <= 25
     order by power(te.latitude_deg - p_lat, 2) + power(te.longitude_deg - p_lon, 2)
     limit 1;
  end if;
  if v_id is not null then
    return (select jsonb_build_object('id', id, 'kind', entity_id, 'name', display_name, 'created', false) from public.tile_entities where id = v_id);
  end if;

  v_name := nullif(btrim(left(coalesce(p_name, ''), 80)), '');
  insert into public.tile_entities(
    location_id, entity_type, entity_id, display_name, source_ref, source_tags,
    placement_mode, x_m, y_m, rotation_deg, footprint_width_m, footprint_depth_m,
    latitude_deg, longitude_deg, spatial_region_id,
    is_state_owned, owner_class, status, staff_capacity
  ) values (
    v_earth, 'building', v_kind, v_name, p_source_ref, jsonb_build_object('real_venue', true, 'amenity', lower(p_amenity)),
    'world', 0, 0, coalesce(p_rotation_deg, 0), p_width_m, p_depth_m,
    p_lat, p_lon, left(coalesce(p_region_id, ''), 80),
    true, 'STATE', 'active', null
  ) returning id into v_id;
  return jsonb_build_object('id', v_id, 'kind', v_kind, 'name', v_name, 'created', true);
end $$;
revoke all on function public.noxia_real_venue(text, text, text, double precision, double precision, text, double precision, double precision, double precision) from public, anon, authenticated;
