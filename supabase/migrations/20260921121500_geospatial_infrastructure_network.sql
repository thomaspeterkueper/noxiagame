-- Persistent metric/geodetic infrastructure network for planetary surfaces.
-- Grid infrastructure remains tile based and does not use these tables.

create table if not exists public.infrastructure_nodes (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  owner_profile_id uuid null references public.profiles(id) on delete set null,
  owner_entity_id uuid null references public.tile_entities(id) on delete cascade,
  network_type text not null check (network_type in ('road','rail','pipeline','power','water','data','conveyor')),
  node_kind text not null check (node_kind in ('junction','facility-port','network-tie-in','terminal','waypoint')),
  source text not null check (source in ('observed','player-built','seeded')),
  spatial_region_id text null,
  x_m double precision null,
  y_m double precision null,
  latitude_deg double precision null check (latitude_deg is null or latitude_deg between -90 and 90),
  longitude_deg double precision null check (longitude_deg is null or longitude_deg between -180 and 180),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((x_m is not null and y_m is not null) or (latitude_deg is not null and longitude_deg is not null))
);

create table if not exists public.infrastructure_edges (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  owner_profile_id uuid null references public.profiles(id) on delete set null,
  network_type text not null check (network_type in ('road','rail','pipeline','power','water','data','conveyor')),
  source text not null check (source in ('observed','player-built','seeded')),
  status text not null check (status in ('planned','building','active','damaged','closed')),
  start_node_id uuid not null references public.infrastructure_nodes(id) on delete restrict,
  end_node_id uuid not null references public.infrastructure_nodes(id) on delete restrict,
  spatial_region_id text null,
  geometry_m jsonb not null,
  geometry_geo jsonb null,
  length_m double precision not null check (length_m > 0),
  class_id text null,
  capacity double precision null,
  speed_limit double precision null,
  condition double precision null check (condition is null or condition between 0 and 1),
  build_cost_credits integer not null default 0 check (build_cost_credits >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists infrastructure_nodes_location_network_idx
  on public.infrastructure_nodes(location_id, network_type);
create index if not exists infrastructure_nodes_owner_entity_idx
  on public.infrastructure_nodes(owner_entity_id) where owner_entity_id is not null;
create index if not exists infrastructure_edges_location_network_idx
  on public.infrastructure_edges(location_id, network_type, status);
create index if not exists infrastructure_edges_owner_idx
  on public.infrastructure_edges(owner_profile_id) where owner_profile_id is not null;

alter table public.infrastructure_nodes enable row level security;
alter table public.infrastructure_edges enable row level security;

-- Game API writes with the service role. Authenticated clients may only inspect
-- infrastructure that belongs to them; observed network geometry continues to
-- come from the canonical region/OSM source rather than being duplicated here.
drop policy if exists infrastructure_nodes_select_own on public.infrastructure_nodes;
create policy infrastructure_nodes_select_own on public.infrastructure_nodes
  for select to authenticated
  using (owner_profile_id = auth.uid());

drop policy if exists infrastructure_edges_select_own on public.infrastructure_edges;
create policy infrastructure_edges_select_own on public.infrastructure_edges
  for select to authenticated
  using (owner_profile_id = auth.uid());
