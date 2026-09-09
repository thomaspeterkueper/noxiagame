create table if not exists public.world_unique_objects (
  id uuid primary key default gen_random_uuid(),
  unique_key text not null unique,
  location_id uuid not null references public.locations(id) on delete cascade,
  tile_entity_id uuid unique references public.tile_entities(id) on delete set null,
  object_kind text not null,
  display_name text not null,
  canon_namespace text not null default 'noxia',
  reality_layer text not null,
  source_work text,
  valid_from_year integer,
  valid_to_year integer,
  latitude_deg double precision not null,
  longitude_deg double precision not null,
  altitude_m double precision,
  is_enterable boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint world_unique_objects_kind_check
    check (object_kind in ('building','site','landmark','historical')),
  constraint world_unique_objects_reality_check
    check (reality_layer in ('real','fictionalized','future','historical')),
  constraint world_unique_objects_lat_check
    check (latitude_deg between -90 and 90),
  constraint world_unique_objects_lon_check
    check (longitude_deg between -180 and 180),
  constraint world_unique_objects_year_check
    check (valid_from_year is null or valid_to_year is null or valid_to_year >= valid_from_year)
);

create index if not exists world_unique_objects_location_idx
  on public.world_unique_objects(location_id);
create index if not exists world_unique_objects_geo_idx
  on public.world_unique_objects(latitude_deg, longitude_deg);

alter table public.world_unique_objects enable row level security;

comment on table public.world_unique_objects is
  'Canonical identities for unique NOXIA world places. Physical placement remains in tile_entities; unique_key is the stable identity across views and epochs.';
comment on column public.world_unique_objects.reality_layer is
  'Relationship to the real world: real, fictionalized, future, or historical.';

-- Unique canonical objects are curated world state, not player-buildable catalog rows.
-- No authenticated/anon mutation policy is created; server-side service-role access remains authoritative.

do $$
declare
  v_location uuid;
  v_entity uuid;
  v_unique uuid;
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
    insert into public.tile_entities (
      location_id,
      entity_type,
      entity_id,
      status,
      condition,
      is_state_owned,
      owner_class,
      placement_mode,
      x_m,
      y_m,
      z_m,
      latitude_deg,
      longitude_deg,
      altitude_m,
      spatial_region_id,
      rotation_deg,
      footprint_width_m,
      footprint_depth_m,
      terrain_status
    ) values (
      v_location,
      'building',
      'ssf_headquarters_sundern',
      'active',
      100,
      true,
      'STATE',
      'world',
      -245.07724823865354,
      1752.1787157953474,
      0,
      51.3407577,
      8.001473,
      null,
      'earth-sauerland',
      0,
      18,
      12,
      'unresolved'
    ) returning id into v_entity;
  else
    update public.tile_entities
    set status = 'active',
        condition = coalesce(condition, 100),
        is_state_owned = true,
        owner_class = 'STATE',
        placement_mode = 'world',
        x_m = -245.07724823865354,
        y_m = 1752.1787157953474,
        z_m = coalesce(z_m, 0),
        latitude_deg = 51.3407577,
        longitude_deg = 8.001473,
        spatial_region_id = 'earth-sauerland',
        rotation_deg = coalesce(rotation_deg, 0),
        footprint_width_m = coalesce(footprint_width_m, 18),
        footprint_depth_m = coalesce(footprint_depth_m, 12),
        terrain_status = coalesce(terrain_status, 'unresolved')
    where id = v_entity;
  end if;

  insert into public.world_unique_objects (
    unique_key,
    location_id,
    tile_entity_id,
    object_kind,
    display_name,
    canon_namespace,
    reality_layer,
    latitude_deg,
    longitude_deg,
    is_enterable,
    metadata
  ) values (
    'ssf_headquarters_sundern',
    v_location,
    v_entity,
    'building',
    'Solar Science Foundation · Hauptsitz',
    'noxia',
    'real',
    51.3407577,
    8.001473,
    true,
    jsonb_build_object(
      'role', 'foundation_headquarters',
      'building_form', 'bungalow',
      'address', 'Bogenstraße 15, 59846 Sundern',
      'region', 'earth-sauerland',
      'canonical', true,
      'description', 'Einzigartiger kanonischer Sitz der Solar Science Foundation.'
    )
  )
  on conflict (unique_key) do update
  set location_id = excluded.location_id,
      tile_entity_id = excluded.tile_entity_id,
      object_kind = excluded.object_kind,
      display_name = excluded.display_name,
      canon_namespace = excluded.canon_namespace,
      reality_layer = excluded.reality_layer,
      latitude_deg = excluded.latitude_deg,
      longitude_deg = excluded.longitude_deg,
      is_enterable = excluded.is_enterable,
      metadata = excluded.metadata,
      updated_at = now()
  returning id into v_unique;
end $$;
