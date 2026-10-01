-- Phobos / Stickney structural-grid v4
--
-- Mirrors the canonical TypeScript seed on a 20 m structural grid.
-- Only canonical STATE-owned Phobos modules with existing spatial coordinates
-- are repositioned; PLAYER-owned rows and pre-spatial legacy rows are untouched.
-- Non-spatial rows are filtered by the shared spatial API instead of mutating
-- their semantic entity type.

with phobos_location as (
  select id
  from public.locations
  where slug = 'phobos'
  limit 1
), layout(entity_id, x_m, y_m, rotation_deg) as (
  values
    ('habitat'::text,             0.0::double precision,    0.0::double precision,   0.0::double precision),
    ('life_support_hub',         40.0,                      0.0,                      0.0),
    ('solar',                  -120.0,                    100.0,                      0.0),
    ('battery_storage',         -60.0,                     60.0,                      0.0),
    ('surface_comms',          -100.0,                    -40.0,                      0.0),
    ('warehouse',               80.0,                     60.0,                      0.0),
    ('surface_workshop',       140.0,                     60.0,                      0.0),
    ('rover_yard',             140.0,                      0.0,                     90.0),
    ('landing_pad_phobos',     220.0,                   -100.0,                      0.0)
)
update public.tile_entities te
set
  x_m = layout.x_m,
  y_m = layout.y_m,
  rotation_deg = layout.rotation_deg
from layout, phobos_location
where te.location_id = phobos_location.id
  and te.entity_type = 'building'
  and te.is_state_owned is true
  and te.owner_class = 'STATE'
  and te.entity_id = layout.entity_id
  and te.x_m is not null
  and te.y_m is not null;
