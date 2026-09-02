-- Anchor the canonical NOXIA Earth start in Sauerland.
-- The site is regionally anchored to Sundern (Sauerland), but exact GPS coordinates
-- remain intentionally unset until a concrete parcel is canonized.

begin;

update public.locations
set name = 'Tharsis Hub Sauerland',
    description = 'Gemeinsamer NOXIA-Earth-Start im Sauerland, Nordrhein-Westfalen, Deutschland. Regionale Referenz: Sundern (Sauerland). Die 32x24-Karte ist eine verdichtete, topografisch plausible Repräsentation und kein Katasterplan.',
    surface_lat = null,
    surface_lon = null,
    updated_at = now()
where slug = 'earth';

update public.facility_instances fi
set name = case fi.seed_key
  when 'earth_public_spaceport' then 'Tharsis Hub Sauerland'
  when 'earth_public_admin' then 'Tharsis Hub Verwaltung'
  when 'earth_public_academy' then 'Tharsis Hub Akademie'
  when 'earth_public_warehouse' then 'Tharsis Hub Logistik'
  else fi.name
end
from public.locations l
where fi.location_id = l.id
  and l.slug = 'earth';

-- New module positions align the live world with the Sauerland terrain map.
-- Target cells were checked empty before the production update on 2026-09-02.
update public.tile_entities te
set tile_row = v.tile_row,
    tile_col = v.tile_col
from public.facility_modules fm
join (values
  ('earth_spaceport_core',19,26),
  ('earth_pad_standard_1',18,26),
  ('earth_pad_standard_2',19,27),
  ('earth_pad_mini_1',20,26),
  ('earth_spaceport_service',19,25),
  ('earth_spaceport_storage',20,25),
  ('earth_admin_core',21,25),
  ('earth_academy_core',21,26),
  ('earth_warehouse_core',21,27),
  ('earth_warehouse_storage_1',21,28)
) as v(seed_key,tile_row,tile_col)
  on v.seed_key = fm.seed_key
where te.id = fm.tile_entity_id;

commit;
