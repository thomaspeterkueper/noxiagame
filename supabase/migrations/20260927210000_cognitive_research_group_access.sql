set search_path to public;

create table if not exists cognitive_research_groups (
  id text primary key,
  domain text not null check (domain in ('chronobiology','plant_science','life_support')),
  display_name text not null,
  status text not null default 'active' check (status in ('active','inactive','dissolved')),
  created_at_tick bigint not null check (created_at_tick >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists cognitive_research_group_grants (
  group_id text not null references cognitive_research_groups(id) on delete cascade,
  evidence_type text not null,
  granted_at_tick bigint not null check (granted_at_tick >= 0),
  revoked_at_tick bigint check (revoked_at_tick is null or revoked_at_tick >= granted_at_tick),
  provenance jsonb not null default '{}'::jsonb,
  primary key (group_id,evidence_type,granted_at_tick)
);

create index if not exists cognitive_research_group_grants_active_idx
  on cognitive_research_group_grants(group_id,evidence_type)
  where revoked_at_tick is null;

alter table cognitive_research_groups enable row level security;
alter table cognitive_research_group_grants enable row level security;

comment on table cognitive_research_group_grants is
  'Institutional evidence access grants. A grant controls discoverability, never ground-truth access or canon authority.';
