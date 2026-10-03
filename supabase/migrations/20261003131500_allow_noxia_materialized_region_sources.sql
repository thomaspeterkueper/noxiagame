-- Allow persistent NOXIA Earth-place lifecycle states in celestial_regions.source.
-- Existing external-source values remain valid; materialized places use noxia:*
-- while importing/failing and overpass:* once real-world enrichment succeeds.

alter table public.celestial_regions
  drop constraint if exists celestial_regions_source_check;

alter table public.celestial_regions
  add constraint celestial_regions_source_check
  check (
    source in ('overpass', 'osm-map-api', 'procedural', 'manual')
    or source like 'overpass:%'
    or source like 'noxia:%'
  );
