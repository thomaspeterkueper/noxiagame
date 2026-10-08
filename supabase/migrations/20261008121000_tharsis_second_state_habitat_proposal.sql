-- NOXIA-LIVING-0010, Stufe 3 — VORSCHLAG, noch nicht entschieden.
--
-- In Tharsis „wohnen" acht unbenannte Personen im Verwaltungsgebäude. Das neue
-- Habitat für die sieben Leitungen hat acht Plätze und reicht für sie nicht.
-- Dieser Vorschlag folgt derselben Regel wie die Entscheidungen vom 2026-10-08
-- (staatliche Grundversorgung zuerst): ein zweites staatliches Habitat, in das
-- die acht umziehen. Es wäre danach voll belegt.
--
-- Nur einspielen, wenn das so gewollt ist. Ohne diese Migration bleiben die acht
-- unverändert im Verwaltungsgebäude gemeldet.

begin;

insert into public.tile_entities (
  location_id, tile_level, tile_row, tile_col, entity_type, entity_id, status,
  is_state_owned, owner_class, placement_mode, x_m, y_m, rotation_deg,
  footprint_width_m, footprint_depth_m, site_id, terrain_dataset_id, terrain_status,
  spatial_region_id, residential_capacity, transient_capacity
)
select admin.location_id, 0, 1, 3, 'building', 'habitat', 'active',
       true, 'STATE', 'world', -250, 210, 0,
       28, 22, admin.site_id, admin.terrain_dataset_id, admin.terrain_status,
       admin.spatial_region_id, 8, 0
from public.tile_entities admin
join public.locations l on l.id = admin.location_id
where l.slug = 'mars' and admin.entity_id = 'admin'
  and not exists (
    select 1 from public.tile_entities te
    where te.location_id = admin.location_id and te.entity_type = 'building'
      and te.tile_level = 0 and te.tile_row = 1 and te.tile_col = 3
  );

update public.person_assignments a
set tile_entity_id = hab.id, updated_at = now()
from public.tile_entities admin
join public.locations l on l.id = admin.location_id and l.slug = 'mars'
join public.tile_entities hab on hab.location_id = admin.location_id and hab.entity_type = 'building'
  and hab.entity_id = 'habitat' and hab.owner_class = 'STATE' and hab.tile_row = 1 and hab.tile_col = 3
where admin.entity_id = 'admin'
  and a.tile_entity_id = admin.id and a.assignment_type = 'home' and a.is_active;

insert into public.person_tenancies (
  assignment_id, person_id, location_id, tile_entity_id, landlord_actor_id,
  rent_per_billing, billing_interval_ticks, next_due_tick, status, origin, tenure
)
select a.id, a.person_id, a.location_id, a.tile_entity_id, public.ensure_public_actor(a.location_id),
       null, 720, null, 'provided', 'backfill', 'provided'
from public.person_assignments a
join public.tile_entities hab on hab.id = a.tile_entity_id and hab.entity_id = 'habitat'
  and hab.owner_class = 'STATE' and hab.tile_row = 1 and hab.tile_col = 3
join public.locations l on l.id = hab.location_id and l.slug = 'mars'
where a.assignment_type = 'home' and a.is_active
on conflict (assignment_id) do update set
  tile_entity_id = excluded.tile_entity_id,
  origin = 'backfill',
  updated_at = now();

commit;
