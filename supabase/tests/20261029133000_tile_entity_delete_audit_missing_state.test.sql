-- NOXIA #541: deletion audit must not invent an open temporal state.
-- Legacy/imported rows may lack an entity_states current row. Even then,
-- a real DELETE must be recorded without fabricating a parcel or an actor.
-- Execute ONLY on a disposable database with the fixture and draft migration.
-- Entire scenario rolls back.
begin;
do $test$
declare
  v_id uuid := '00000000-0000-4000-8000-000000000001';
  v_before bigint;
  v_event public.simulation_events%rowtype;
begin
  perform 1 from public.tile_entities where id = v_id for update;
  if not found then
    raise exception 'NOXIA_TEST_FIXTURE_MISSING: expected Earth building';
  end if;

  -- Simulate an incomplete legacy projection, without changing the
  -- authoritative entity before exercising the trigger.
  delete from public.entity_states
   where subject_type = 'tile_entity' and subject_id = v_id;
  if exists (select 1 from public.entity_states
             where subject_type = 'tile_entity' and subject_id = v_id) then
    raise exception 'NOXIA_TEST_FAIL: temporal-state fixture was not cleared';
  end if;

  select count(*) into v_before from public.simulation_events
   where subject_type = 'tile_entity' and subject_id = v_id
     and event_type = 'entity.deleted'
     and metadata->>'source' = 'tile_entities_delete_trigger';

  delete from public.tile_entities where id = v_id;
  if not found then
    raise exception 'NOXIA_TEST_FAIL: expected building DELETE';
  end if;

  select * into v_event from public.simulation_events
   where subject_type = 'tile_entity' and subject_id = v_id
     and event_type = 'entity.deleted'
     and metadata->>'source' = 'tile_entities_delete_trigger'
   order by created_at desc, id desc limit 1;

  if not found or
     (select count(*) from public.simulation_events
       where subject_type = 'tile_entity' and subject_id = v_id
         and event_type = 'entity.deleted'
         and metadata->>'source' = 'tile_entities_delete_trigger') <> v_before + 1 then
    raise exception 'NOXIA_TEST_FAIL: deletion without temporal state not audited exactly once';
  end if;

  if v_event.actor_id is not null
     or v_event.effects->0->>'type' is distinct from 'entity_state'
     or v_event.effects->0->'to' is distinct from 'null'::jsonb
     or v_event.effects->0->'from'->>'source_ref' is distinct from 'osm:way:1234567'
     or v_event.effects->0->'from' ? 'parcel_id'
     or v_event.metadata ? 'parcel_id' then
    raise exception 'NOXIA_TEST_FAIL: legacy deletion fabricated attribution or parcel identity';
  end if;

  if exists (select 1 from public.entity_states
             where subject_type = 'tile_entity' and subject_id = v_id) then
    raise exception 'NOXIA_TEST_FAIL: deletion fabricated temporal history';
  end if;

  raise notice 'NOXIA_TEST_OK: missing-current-state deletion audited without invented identity (rollback follows)';
end
$test$;
rollback;
