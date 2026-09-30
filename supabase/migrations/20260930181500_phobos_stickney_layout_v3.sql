-- Phobos / Stickney layout v3
--
-- Purpose:
--   Replace the visually road-like diagonal module chain with a body-specific
--   split-cluster grammar: compact pressure core, utility fan, separate
--   logistics cluster and a remote landing/cargo zone.
--
-- Safety:
--   * only canonical STATE-owned Phobos modules are moved
--   * PLAYER-owned entities are intentionally excluded
--   * footprints are not resized here; the persisted physical dimensions stay
--     authoritative for collision/build checks
--
-- The matching TypeScript seed enforces >=14 m conservative edge clearance.

with phobos_location as (
  select id
  from public.locations
  where slug = 'phobos'
  limit 1
), layout(entity_id, x_m, y_m, rotation_deg) as (
  values
    ('habitat'::text,             0.0::double precision,    0.0::double precision, 354.0::double precision),
    ('life_support_hub',         40.0,                      2.0,                    4.0),
    ('solar',                  -126.0,                     96.0,                  332.0),
    ('battery_storage',         -58.0,                     66.0,                  348.0),
    ('surface_comms',          -108.0,                    -28.0,                   14.0),
    ('warehouse',               86.0,                     62.0,                    8.0),
    ('surface_workshop',       134.0,                     60.0,                  350.0),
    ('rover_yard',             132.0,                      4.0,                   78.0),
    ('landing_pad_phobos',     222.0,                    -92.0,                   26.0)
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
  and te.entity_id = layout.entity_id;
