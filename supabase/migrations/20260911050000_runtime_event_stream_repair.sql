-- NOXIA runtime event-stream production repair
-- 2026-09-11
--
-- Production had recorded the historical runtime-event migrations without the
-- corresponding simulation_events/entity_states objects. The atomic Transit
-- Core writes transit.departed/transit.arrived into simulation_events, so a
-- departure failed transactionally with 42P01 while the relation was missing.
--
-- This migration is deliberately idempotent. Fresh databases already receive
-- the same model from the historical runtime-event migrations; existing drifted
-- databases are repaired here without touching legacy public.events.

set search_path to public;

create table if not exists public.simulation_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  subject_type text not null,
  subject_id uuid,
  actor_id uuid,
  location_id uuid,
  tick bigint,
  effect_group_id uuid not null default gen_random_uuid(),
  effects jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  canonical_entity_id text,
  canonical_event_id text,
  constraint simulation_events_effects_array check (jsonb_typeof(effects) = 'array'),
  constraint simulation_events_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index if not exists simulation_events_subject_idx
  on public.simulation_events(subject_type, subject_id, occurred_at desc);
create index if not exists simulation_events_location_idx
  on public.simulation_events(location_id, occurred_at desc);
create index if not exists simulation_events_tick_idx
  on public.simulation_events(tick) where tick is not null;
create index if not exists simulation_events_effect_group_idx
  on public.simulation_events(effect_group_id);
create index if not exists simulation_events_canonical_entity_idx
  on public.simulation_events(canonical_entity_id) where canonical_entity_id is not null;
create index if not exists simulation_events_canonical_event_idx
  on public.simulation_events(canonical_event_id) where canonical_event_id is not null;

create table if not exists public.entity_states (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null,
  subject_id uuid not null,
  valid_from timestamptz not null,
  valid_to timestamptz,
  properties jsonb not null default '{}'::jsonb,
  source_event uuid references public.simulation_events(id) on delete set null,
  canonical_entity_id text,
  canonical_state_id text,
  created_at timestamptz not null default now(),
  constraint entity_states_valid_range check (valid_to is null or valid_to > valid_from),
  constraint entity_states_properties_object check (jsonb_typeof(properties) = 'object')
);

create unique index if not exists entity_states_one_current_idx
  on public.entity_states(subject_type, subject_id) where valid_to is null;
create index if not exists entity_states_history_idx
  on public.entity_states(subject_type, subject_id, valid_from desc);
create index if not exists entity_states_source_event_idx
  on public.entity_states(source_event) where source_event is not null;
create index if not exists entity_states_canonical_entity_idx
  on public.entity_states(canonical_entity_id) where canonical_entity_id is not null;
create index if not exists entity_states_canonical_state_idx
  on public.entity_states(canonical_state_id) where canonical_state_id is not null;

alter table public.simulation_events enable row level security;
alter table public.entity_states enable row level security;
revoke all on table public.simulation_events from anon, authenticated;
revoke all on table public.entity_states from anon, authenticated;
grant all on table public.simulation_events to service_role;
grant all on table public.entity_states to service_role;

create or replace function public.noxia_record_player_build_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
  v_effects jsonb;
begin
  if tg_op = 'INSERT' then
    v_type := case
      when new.status = 'building' then 'build.started'
      when new.status = 'selling' then 'building.sale_started'
      else 'build.created'
    end;
    v_effects := jsonb_build_array(jsonb_build_object(
      'type','build_status','buildable_id',new.buildable_id,'status',new.status,
      'tile_level',new.tile_level,'tile_row',new.tile_row,'tile_col',new.tile_col,
      'completes_at',new.completes_at
    ));
  else
    if new.status is not distinct from old.status
      and new.completes_at is not distinct from old.completes_at then
      return new;
    end if;
    v_type := 'build.status_changed';
    v_effects := jsonb_build_array(jsonb_build_object(
      'type','build_status','buildable_id',new.buildable_id,'from',old.status,
      'to',new.status,'tile_level',new.tile_level,'tile_row',new.tile_row,
      'tile_col',new.tile_col,'completes_at',new.completes_at
    ));
  end if;

  insert into public.simulation_events (
    event_type,subject_type,subject_id,actor_id,location_id,effects,metadata,occurred_at
  ) values (
    v_type,'build',new.id,new.profile_id,new.location_id,v_effects,
    jsonb_build_object('source','player_builds_trigger'),now()
  );
  return new;
end;
$$;

drop trigger if exists noxia_player_build_event on public.player_builds;
create trigger noxia_player_build_event
  after insert or update of status, completes_at on public.player_builds
  for each row execute function public.noxia_record_player_build_event();

create or replace function public.noxia_record_tile_entity_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_event_type text;
  v_properties jsonb;
  v_effects jsonb;
begin
  v_event_type := case when tg_op = 'INSERT' then 'entity.created' else 'entity.updated' end;
  v_properties := jsonb_build_object(
    'entity_type',new.entity_type,'entity_id',new.entity_id,'location_id',new.location_id,
    'tile_level',new.tile_level,'tile_row',new.tile_row,'tile_col',new.tile_col,
    'profile_id',new.profile_id,'actor_id',new.actor_id,'owner_class',new.owner_class,
    'owner_id',new.owner_id,'occupant_id',new.occupant_id,'condition',new.condition,
    'status',new.status,'parent_id',new.parent_id,'slot',new.slot
  );
  if tg_op = 'INSERT' then
    v_effects := jsonb_build_array(jsonb_build_object('type','entity_state','to',v_properties));
  else
    v_effects := jsonb_build_array(jsonb_build_object(
      'type','entity_state',
      'from',jsonb_build_object(
        'location_id',old.location_id,'tile_level',old.tile_level,'tile_row',old.tile_row,
        'tile_col',old.tile_col,'owner_class',old.owner_class,'owner_id',old.owner_id,
        'occupant_id',old.occupant_id,'condition',old.condition,'status',old.status,
        'parent_id',old.parent_id,'slot',old.slot
      ),
      'to',v_properties
    ));
  end if;

  insert into public.simulation_events (
    event_type,subject_type,subject_id,actor_id,location_id,effects,metadata,occurred_at
  ) values (
    v_event_type,'tile_entity',new.id,coalesce(new.profile_id,new.actor_id),new.location_id,
    v_effects,jsonb_build_object('source','tile_entities_trigger'),now()
  ) returning id into v_event_id;

  update public.entity_states
  set valid_to = now()
  where subject_type='tile_entity' and subject_id=new.id and valid_to is null;

  insert into public.entity_states (
    subject_type,subject_id,valid_from,properties,source_event
  ) values ('tile_entity',new.id,now(),v_properties,v_event_id);

  return new;
end;
$$;

drop trigger if exists noxia_tile_entity_state on public.tile_entities;
create trigger noxia_tile_entity_state
  after insert or update of location_id,tile_level,tile_row,tile_col,profile_id,actor_id,
    owner_class,owner_id,occupant_id,condition,status,parent_id,slot
  on public.tile_entities
  for each row execute function public.noxia_record_tile_entity_state();

revoke all on function public.noxia_record_player_build_event() from public, anon, authenticated;
revoke all on function public.noxia_record_tile_entity_state() from public, anon, authenticated;
grant execute on function public.noxia_record_player_build_event() to service_role;
grant execute on function public.noxia_record_tile_entity_state() to service_role;

comment on table public.simulation_events is
  'Authoritative NOXIA runtime simulation event stream. Separate from legacy public.events.';
comment on table public.entity_states is
  'Temporal NOXIA runtime state history derived from simulation_events.';
comment on function public.noxia_record_player_build_event() is
  'Authoritative audit/event projection for player_builds lifecycle changes into simulation_events.';
comment on function public.noxia_record_tile_entity_state() is
  'Projects tile_entities mutations into simulation_events and temporal entity_states.';
