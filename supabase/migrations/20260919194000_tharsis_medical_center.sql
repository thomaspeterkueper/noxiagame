-- Canonical Tharsis Medical Center for Living Population.
-- Runtime-safe/idempotent seed: no generated UUID is hard-coded.

insert into public.building_definitions (
  key, name, description, category, tier, cost_credits, build_time_ticks,
  production, consumption, population_bonus, allowed_locations, sort_order, is_active
) values (
  'medical_core', 'Medical Center',
  'Medizinisches Zentrum von Tharsis Hub für Versorgung, Diagnostik und Koloniegesundheit.',
  'services', 2, 5000, 4, '[]'::jsonb, '[]'::jsonb, 0, array['mars'], 80, true
)
on conflict (key) do update set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  tier = excluded.tier,
  allowed_locations = excluded.allowed_locations,
  sort_order = excluded.sort_order,
  is_active = true;

with tharsis as (
  select id from public.locations where slug = 'mars' limit 1
)
insert into public.tile_entities (
  location_id, tile_level, tile_row, tile_col, entity_type, entity_id,
  is_state_owned, owner_class, status, placement_mode
)
select id, 0, 3, 7, 'building', 'medical_core', true, 'STATE', 'active', 'legacy_tile'
from tharsis
where not exists (
  select 1 from public.tile_entities te
  where te.location_id = tharsis.id
    and te.entity_type = 'building'
    and te.entity_id = 'medical_core'
);

update public.person_assignments pa
set tile_entity_id = med.id
from public.people p
join public.locations l on l.slug = 'mars'
join lateral (
  select te.id
  from public.tile_entities te
  where te.location_id = l.id and te.entity_type = 'building' and te.entity_id = 'medical_core'
  order by te.created_at, te.id
  limit 1
) med on true
where pa.person_id = p.id
  and p.person_key = 'amara-reyes'
  and pa.assignment_type = 'work'
  and pa.is_active = true
  and pa.location_id = l.id
  and pa.tile_entity_id is distinct from med.id;
