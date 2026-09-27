set search_path to public;

-- Persistent institutional cognition. These records store structured simulation
-- artifacts; prose/LLM output is never authoritative state.

create table if not exists cognitive_research_artifacts (
  id text primary key,
  artifact_type text not null check (artifact_type in (
    'research_finding','research_challenge','scientific_controversy',
    'controversy_revision','evidence_backed_decision','narrative_candidate',
    'narrative_review','canonization_record'
  )),
  subject_ref text not null,
  producer_ref text,
  simulation_tick bigint not null check (simulation_tick >= 0),
  confidence double precision check (confidence is null or (confidence >= 0 and confidence <= 1)),
  status text not null,
  evidence_refs text[] not null default '{}',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists cognitive_research_artifacts_subject_idx
  on cognitive_research_artifacts(subject_ref, simulation_tick);
create index if not exists cognitive_research_artifacts_type_idx
  on cognitive_research_artifacts(artifact_type, simulation_tick);
create index if not exists cognitive_research_artifacts_producer_idx
  on cognitive_research_artifacts(producer_ref, simulation_tick)
  where producer_ref is not null;

alter table cognitive_research_artifacts enable row level security;

comment on table cognitive_research_artifacts is
  'Persistent structured cognition/research history. Canonization requires an explicit canonization_record; narrative_candidate alone is never canon.';
