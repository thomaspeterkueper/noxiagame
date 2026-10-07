-- Q1 social fabric: overlapping residential/care groups and station AI.
create table if not exists public.social_groups (
 id uuid primary key default gen_random_uuid(),
 location_id uuid not null references public.locations(id) on delete cascade,
 group_key text not null,
 group_type text not null check(group_type in ('residential_collective','care_circle','learning_cohort','club','project_group')),
 display_name text not null,
 traits jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 unique(location_id,group_key)
);
create table if not exists public.social_group_memberships (
 group_id uuid not null references public.social_groups(id) on delete cascade,
 person_id uuid not null references public.people(id) on delete cascade,
 role_code text not null default 'member',
 care_responsibility numeric not null default 0 check(care_responsibility between 0 and 1),
 starts_tick bigint,
 ends_tick bigint,
 is_active boolean not null default true,
 primary key(group_id,person_id,role_code)
);
create index if not exists idx_social_members_person on public.social_group_memberships(person_id) where is_active;

create table if not exists public.station_agents (
 id uuid primary key default gen_random_uuid(),
 location_id uuid not null references public.locations(id) on delete cascade,
 agent_key text not null,
 display_name text not null,
 agent_type text not null check(agent_type in ('station_ai')),
 autonomy_scope jsonb not null default '{}'::jsonb,
 policy jsonb not null default '{}'::jsonb,
 state jsonb not null default '{}'::jsonb,
 is_active boolean not null default true,
 unique(location_id,agent_key)
);

insert into public.station_agents(location_id,agent_key,display_name,agent_type,autonomy_scope,policy)
select l.id,'station-ai','Q1 Station Intelligence','station_ai',
 '{"domains":["life_support_coordination","mobility","scheduling","public_information","learning_support","care_coordination","maintenance_triage","emergency_response"]}'::jsonb,
 '{"principles":["human_agency","privacy_by_default","explainable_intervention","least_intrusive_action","child_safeguarding"],"not_omniscient":true}'::jsonb
from public.locations l where l.slug='q1'
on conflict(location_id,agent_key) do update set autonomy_scope=excluded.autonomy_scope,policy=excluded.policy,is_active=true;

alter table public.social_groups enable row level security;
alter table public.social_group_memberships enable row level security;
alter table public.station_agents enable row level security;
