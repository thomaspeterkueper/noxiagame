-- Forward compatibility for databases where the 2026-08-31 runtime-event migrations
-- are already recorded in migration history.
--
-- Fresh databases obtain the same shape from the corrected historical migrations.
-- Existing databases obtain it here without mutating or converting legacy public.events.
-- Pre-fix generalized public.events rows (the shape the pre-fix 2026-08-31 foundation
-- created) are carried over id-preserving into simulation_events so recorded runtime
-- history survives the table switch; the legacy bigint/type/payload public.events table
-- is never touched.
-- This migration is intentionally idempotent and also repairs an intermediate
-- entity_states.source_event foreign key if such a partial schema exists.
--
-- It also re-installs the runtime trigger functions and triggers. Databases that
-- recorded the pre-fix 20260831164500 content still run the old security-definer
-- triggers, whose bodies insert event_type/subject_type/... into legacy
-- public.events (historical bigint/type/payload shape); plpgsql bodies are not
-- validated at CREATE time, so those migrations recorded successfully but every
-- player_builds/tile_entities mutation fails at runtime. Re-creating the functions
-- and triggers here repoints both at simulation_events.

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
  source_event uuid,
  canonical_entity_id text,
  canonical_state_id text,
  created_at timestamptz not null default now(),
  constraint entity_states_valid_range check (valid_to is null or valid_to > valid_from),
  constraint entity_states_properties_object check (jsonb_typeof(properties) = 'object')
);

alter table public.entity_states
  add column if not exists canonical_entity_id text,
  add column if not exists canonical_state_id text;

-- Repair any partially-created source_event FK without assuming its generated name.
do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where c.contype = 'f'
      and n.nspname = 'public'
      and t.relname = 'entity_states'
      and exists (
        select 1
        from unnest(c.conkey) key_attnum
        join pg_attribute a on a.attrelid = t.oid and a.attnum = key_attnum
        where a.attname = 'source_event'
      )
  loop
    execute format('alter table public.entity_states drop constraint %I', r.conname);
  end loop;
end $$;

-- Databases that recorded the pre-fix 2026-08-31 foundation carry recorded runtime
-- history in generalized public.events (uuid/event_type/subject_type/...), with
-- entity_states.source_event referencing public.events.id. Copy those rows into
-- simulation_events id-preserving so the history survives the switch and the FK below
-- can validate. Guarded on the generalized event_type column so the legacy
-- bigint/type/payload public.events shape is never read; idempotent for re-runs.
do $$
begin
  if exists (
    select 1
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'events'
      and a.attname = 'event_type'
      and not a.attisdropped
  ) then
    insert into public.simulation_events (
      id, event_type, subject_type, subject_id, actor_id, location_id, tick,
      effect_group_id, effects, metadata, occurred_at, created_at,
      canonical_entity_id, canonical_event_id
    )
    select
      id, event_type, subject_type, subject_id, actor_id, location_id, tick,
      effect_group_id, effects, metadata, occurred_at, created_at,
      null::text, null::text
    from public.events
    on conflict (id) do nothing;
  end if;
end $$;

-- Null any source_event that still does not resolve in simulation_events (rows whose
-- generalized public.events row is already gone, or states written without an event).
-- Runs after the carry-over so only genuinely dangling references are cleared before
-- the FK is added.
update public.entity_states
set source_event = null
where source_event is not null
  and not exists (
    select 1 from public.simulation_events se where se.id = entity_states.source_event
  );

alter table public.entity_states
  add constraint entity_states_source_event_fkey
  foreign key (source_event) references public.simulation_events(id) on delete set null
  not valid;

-- The carry-over and repair above guarantee every remaining source_event resolves;
-- validate explicitly so the constraint ends fully checked, not NOT VALID.
alter table public.entity_states
  validate constraint entity_states_source_event_fkey;

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

comment on table public.simulation_events is
  'Authoritative NOXIA runtime simulation event stream. Separate from legacy public.events.';
comment on table public.entity_states is
  'Temporal NOXIA runtime state history derived from simulation_events.';

-- Repair the runtime trigger functions for databases whose migration history
-- recorded the pre-fix 20260831164500 content. The recorded function bodies
-- target legacy public.events columns that do not exist, so both triggers fail
-- on every player_builds/tile_entities mutation. This mirrors the corrected
-- 20260831164500 content and is a no-op for fresh databases replaying it.
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
    v_effects := jsonb_build_array(jsonb_build_object('type','build_status','buildable_id',new.buildable_id,'status',new.status,'tile_level',new.tile_level,'tile_row',new.tile_row,'tile_col',new.tile_col,'completes_at',new.completes_at));
  else
    if new.status is not distinct from old.status and new.completes_at is not distinct from old.completes_at then return new; end if;
    v_type := 'build.status_changed';
    v_effects := jsonb_build_array(jsonb_build_object('type','build_status','buildable_id',new.buildable_id,'from',old.status,'to',new.status,'tile_level',new.tile_level,'tile_row',new.tile_row,'tile_col',new.tile_col,'completes_at',new.completes_at));
  end if;

  insert into public.simulation_events (event_type,subject_type,subject_id,actor_id,location_id,effects,metadata,occurred_at)
  values (v_type,'build',new.id,new.profile_id,new.location_id,v_effects,jsonb_build_object('source','player_builds_trigger'),now());
  return new;
end;
$$;

drop trigger if exists noxia_player_build_event on public.player_builds;
create trigger noxia_player_build_event after insert or update of status, completes_at on public.player_builds for each row execute function public.noxia_record_player_build_event();

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
  v_properties := jsonb_build_object('entity_type',new.entity_type,'entity_id',new.entity_id,'location_id',new.location_id,'tile_level',new.tile_level,'tile_row',new.tile_row,'tile_col',new.tile_col,'profile_id',new.profile_id,'actor_id',new.actor_id,'owner_class',new.owner_class,'owner_id',new.owner_id,'occupant_id',new.occupant_id,'condition',new.condition,'status',new.status,'parent_id',new.parent_id,'slot',new.slot);
  if tg_op = 'INSERT' then
    v_effects := jsonb_build_array(jsonb_build_object('type','entity_state','to',v_properties));
  else
    v_effects := jsonb_build_array(jsonb_build_object('type','entity_state','from',jsonb_build_object('location_id',old.location_id,'tile_level',old.tile_level,'tile_row',old.tile_row,'tile_col',old.tile_col,'owner_class',old.owner_class,'owner_id',old.owner_id,'occupant_id',old.occupant_id,'condition',old.condition,'status',old.status,'parent_id',old.parent_id,'slot',old.slot),'to',v_properties));
  end if;

  insert into public.simulation_events (event_type,subject_type,subject_id,actor_id,location_id,effects,metadata,occurred_at)
  values (v_event_type,'tile_entity',new.id,coalesce(new.profile_id,new.actor_id),new.location_id,v_effects,jsonb_build_object('source','tile_entities_trigger'),now()) returning id into v_event_id;

  update public.entity_states set valid_to = now() where subject_type='tile_entity' and subject_id=new.id and valid_to is null;
  insert into public.entity_states (subject_type,subject_id,valid_from,properties,source_event) values ('tile_entity',new.id,now(),v_properties,v_event_id);
  return new;
end;
$$;

drop trigger if exists noxia_tile_entity_state on public.tile_entities;
create trigger noxia_tile_entity_state after insert or update of location_id,tile_level,tile_row,tile_col,profile_id,actor_id,owner_class,owner_id,occupant_id,condition,status,parent_id,slot on public.tile_entities for each row execute function public.noxia_record_tile_entity_state();

comment on function public.noxia_record_player_build_event() is 'Authoritative audit/event projection for player_builds lifecycle changes into simulation_events.';
comment on function public.noxia_record_tile_entity_state() is 'Projects tile_entities mutations into simulation_events and temporal entity_states.';
