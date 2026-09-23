-- Reposition only the canonical STATE-owned Shackleton Base Alpha starter facilities.
-- Player-owned buildings are intentionally untouched.

with moon as (
  select id from locations where slug = 'moon'
)
update tile_entities t
set
  x_m = v.x_m,
  y_m = v.y_m,
  rotation_deg = v.rotation_deg
from moon,
(values
  ('habitat',            -55::numeric,   30::numeric,  8::numeric),
  ('life_support_hub',   -15::numeric,   28::numeric,  8::numeric),
  ('solar',             -135::numeric,  105::numeric,  0::numeric),
  ('battery_storage',    -78::numeric,   82::numeric,  4::numeric),
  ('warehouse',           42::numeric,    5::numeric, 12::numeric),
  ('surface_workshop',    45::numeric,  -38::numeric, 12::numeric),
  ('rover_yard',          98::numeric,  -48::numeric, 12::numeric),
  ('surface_comms',      -18::numeric,   88::numeric,  0::numeric),
  ('landing_pad_moon',   175::numeric, -105::numeric, 20::numeric)
) as v(entity_id, x_m, y_m, rotation_deg)
where t.location_id = moon.id
  and t.owner_class = 'STATE'
  and t.entity_type in ('building', 'module')
  and t.entity_id = v.entity_id;
