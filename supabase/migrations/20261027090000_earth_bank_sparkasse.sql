-- 20261027090000_earth_bank_sparkasse.sql
-- Die staatliche Bank in Sundern zieht an den realen Ort der Sparkasse
-- (Thomas, 27.10.2026): Sparkasse Mitten im Sauerland, BeratungsCenter Sundern,
-- Hauptstraße 140, 59846 Sundern (Quelle: sparkasse.de, Filiale 16420).
--
-- Die Kartendaten (region_features) führen Hauptstraße 140 nicht als Hausnummer.
-- Nach der Nummernfolge der geraden Seite (138 → 144) ist es das Haus ohne
-- Adresse dazwischen: osm:way:246890726, 24,8 × 16,2 m, 338 m², gedreht 36,9°.
-- Maße aus lib/worldlab/buildingOffer.ts (buildingFacts) aus dem OSM-Grundriss,
-- Lage relativ zur Region earth-sauerland (51,325 N / 8,005 O) wie beim Startcafé.
--
-- Kennung, Konten, Eigentum (Staat) und Personal bleiben; nur Ort, Grundriss und
-- Name wechseln. Wer an der Bank verankert ist, steht danach am neuen Haus.

set search_path to public;

do $$
declare
  v_earth uuid;
  v_bank uuid;
  v_src constant text := 'osm:way:246890726';
  v_lat constant double precision := 51.330839087;
  v_lon constant double precision := 8.004186507;
  v_x constant double precision := -56.59;
  v_y constant double precision := 650.01;
begin
  select id into v_earth from public.locations where slug = 'earth';
  if v_earth is null then return; end if;
  select te.id into v_bank from public.tile_entities te
   where te.location_id = v_earth and te.entity_type = 'building' and te.entity_id = 'bank'
     and te.status = 'active' and te.is_state_owned
   order by te.created_at, te.id limit 1;
  if v_bank is null then raise notice 'Staatliche Bank nicht gefunden – nichts verlegt'; return; end if;
  if exists (select 1 from public.tile_entities where source_ref = v_src and id <> v_bank) then
    raise notice 'Hauptstraße 140 ist bereits belegt – Bank bleibt, wo sie ist'; return;
  end if;

  update public.tile_entities
     set latitude_deg = v_lat, longitude_deg = v_lon, x_m = v_x, y_m = v_y,
         rotation_deg = 36.9, footprint_width_m = 24.8, footprint_depth_m = 16.2,
         spatial_region_id = 'earth-sauerland',
         source_ref = v_src, display_name = 'Sparkasse · Hauptstraße 140',
         staff_capacity = greatest(4, coalesce(staff_capacity, 0))
   where id = v_bank and source_ref is distinct from v_src;

  update public.person_surface_presence
     set latitude_deg = v_lat, longitude_deg = v_lon, x_m = v_x, y_m = v_y
   where source_ref = 'tile_entity:' || v_bank::text;
end $$;
