set search_path to public;

create table if not exists research_samples (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references region_resources(id) on delete cascade,
  owner_profile_id uuid references profiles(id) on delete set null,
  source_inventory_id uuid references logistics_inventories(id) on delete set null,
  destination_inventory_id uuid references logistics_inventories(id) on delete set null,
  return_job_id uuid references transport_jobs(id) on delete set null,
  sample_kind text not null default 'reference',
  status text not null default 'collected' check (status in ('collected','in_transit','returned','analyzed','archived')),
  collected_at timestamptz not null default now(),
  returned_at timestamptz,
  analyzed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (prospect_id, sample_kind)
);

create table if not exists sample_analyses (
  id uuid primary key default gen_random_uuid(),
  sample_id uuid not null unique references research_samples(id) on delete cascade,
  prospect_id uuid not null references region_resources(id) on delete cascade,
  analyst_profile_id uuid references profiles(id) on delete set null,
  facility_entity_id uuid references tile_entities(id) on delete set null,
  method text not null,
  quality_score double precision not null check (quality_score >= 0 and quality_score <= 1),
  finding text not null check (finding in ('confirmed','inconclusive','rejected')),
  measured_signal_index double precision not null check (measured_signal_index >= 0 and measured_signal_index <= 1),
  composition jsonb not null default '{}'::jsonb,
  development_status text not null check (development_status in ('blocked','drilling_authorized','extraction_candidate')),
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table research_samples enable row level security;
alter table sample_analyses enable row level security;

-- Preserve already-collected Stickney reference samples when upgrading from the
-- first sample-return slice. The source cache carries the physical sample.
insert into research_samples (
  prospect_id, source_inventory_id, sample_kind, status, collected_at, metadata
)
select
  rr.id,
  li.id,
  coalesce(nullif(rr.properties->>'sample_kind',''),'regolith_reference'),
  'collected',
  coalesce((rr.properties->>'sampled_at')::timestamptz, now()),
  jsonb_build_object(
    'body','phobos',
    'surfaceHub','stickney-alpha',
    'provenance',coalesce(rr.properties->>'provenance','derived-gameplay-model')
  )
from region_resources rr
join logistics_inventories li
  on li.subject_type='region_resource' and li.subject_id=rr.id
where rr.properties->>'body'='phobos'
  and rr.properties ? 'sampled_at'
on conflict (prospect_id, sample_kind) do nothing;
