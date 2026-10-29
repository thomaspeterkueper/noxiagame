-- NOXIA #541: a bulk DELETE can affect different tile_entity types.
-- The trigger must emit one audit per deleted row, but never turn a generic
-- deletion into a civic demolition approval or a canonical parcel receipt.
-- Disposable PostgreSQL fixture + draft migration only. All writes roll back.
begin;
do $test$
declare
  v_building uuid := '00000000-0000-4000-8000-000000000001';
  v_other uuid := '00000000-0000-4000-8000-000000000004';
  v_deleted integer;
  v_count integer;
begin
  if not exists (
    select 1 from public.tile_entities
     where id = v_building and source_ref = 'osm:way:1234567'
  ) then
    raise exception 'NOXIA_TEST_FIXTURE_MISSING: expected purchased Earth building';
  end if;

  insert into public.tile_entities (
    id, profile_id, location_id, entity_type, entity_id, source_ref
  ) values (
    v_other,
    '00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000003',
    'equipment', 'test_lamp', null
  );
  insert into public.entity_states (
    subject_type, subject_id, valid_from, properties
  ) values (
    'tile_entity', v_other, clock_timestamp() - interval '1 minute',
    '{"entity_type":"equipment"}'::jsonb
  );

  -- One SQL statement must produce two independent, unprivileged audit rows.
  delete from public.tile_entities where id in (v_building, v_other);
  get diagnostics v_deleted = row_count;
  if v_deleted <> 2 then
    raise exception 'NOXIA_TEST_FAIL: expected two deleted tile entities, got %', v_deleted;
  end if;

  select count(*) into v_count
    from public.simulation_events
   where event_type = 'entity.deleted'
     and subject_type = 'tile_entity'
     and subject_id in (v_building, v_other);
  if v_count <> 2 or (
    select count(distinct subject_id)
      from public.simulation_events
     where event_type = 'entity.deleted'
       and subject_type = 'tile_entity'
       and subject_id in (v_building, v_other)
  ) <> 2 then
    raise exception 'NOXIA_TEST_FAIL: bulk DELETE must audit each subject exactly once';
  end if;

  if exists (
    select 1 from public.simulation_events e
     where e.event_type = 'entity.deleted'
       and e.subject_type = 'tile_entity'
       and e.subject_id in (v_building, v_other)
       and (
         e.actor_id is not null
         or e.metadata->>'source' is distinct from 'tile_entities_delete_trigger'
         or e.metadata->>'deletion_kind' is distinct from 'unspecified'
         or e.metadata ? 'parcel_id'
         or e.metadata ? 'approved'
         or e.effects->0->>'type' is distinct from 'entity_state'
         or e.effects->0->'to' is distinct from 'null'::jsonb
         or e.effects->0->'from' ? 'parcel_id'
       )
  ) then
    raise exception 'NOXIA_TEST_FAIL: generic deletion was misattributed or promoted to civic action';
  end if;

  if not exists (
    select 1 from public.simulation_events
     where event_type = 'entity.deleted' and subject_id = v_building
       and metadata->>'source_ref' = 'osm:way:1234567'
       and effects->0->'from'->>'entity_type' = 'building'
  ) or not exists (
    select 1 from public.simulation_events
     where event_type = 'entity.deleted' and subject_id = v_other
       and metadata->>'source_ref' is null
       and effects->0->'from'->>'entity_type' = 'equipment'
  ) then
    raise exception 'NOXIA_TEST_FAIL: mixed DELETE lost original subject identity';
  end if;

  if exists (
    select 1 from public.entity_states
     where subject_type = 'tile_entity'
       and subject_id in (v_building, v_other)
       and valid_to is null
  ) then
    raise exception 'NOXIA_TEST_FAIL: bulk-deleted entity retained a current temporal state';
  end if;

  raise notice 'NOXIA_TEST_OK: mixed bulk DELETE audited without invented civic authority (rollback follows)';
end
$test$;
rollback;
