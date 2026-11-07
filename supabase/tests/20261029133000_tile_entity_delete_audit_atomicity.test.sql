-- Negative atomicity regression for #541. Disposable PostgreSQL only.
-- A failed event audit must abort the building DELETE and temporal closure.
-- Run after the minimal fixture and draft migration, never on production.
begin;

-- Force the AFTER DELETE audit INSERT to fail inside the same transaction.
alter table public.simulation_events
  add constraint noxia_test_reject_entity_deleted
  check (event_type <> 'entity.deleted');

do $test$
declare
  v_id uuid := '00000000-0000-4000-8000-000000000001';
  v_before_events bigint;
  v_before_state timestamptz;
  v_constraint text;
begin
  if not exists (
    select 1 from public.tile_entities
    where id = v_id and entity_type = 'building'
      and source_ref = 'osm:way:1234567'
  ) then
    raise exception 'NOXIA_TEST_FIXTURE_MISSING: Earth building for atomicity regression';
  end if;

  select valid_from into v_before_state
    from public.entity_states
   where subject_type = 'tile_entity' and subject_id = v_id
     and valid_to is null;
  if v_before_state is null then
    raise exception 'NOXIA_TEST_FIXTURE_MISSING: open temporal state for atomicity regression';
  end if;

  select count(*) into v_before_events from public.simulation_events
   where event_type = 'entity.deleted'
     and subject_type = 'tile_entity' and subject_id = v_id;

  begin
    delete from public.tile_entities where id = v_id;
    raise exception 'NOXIA_TEST_FAIL: DELETE succeeded without a durable audit event';
  exception
    when check_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint is distinct from 'noxia_test_reject_entity_deleted' then
        raise exception 'NOXIA_TEST_FAIL: unexpected check constraint %', v_constraint;
      end if;
  end;

  if not exists (select 1 from public.tile_entities where id = v_id) then
    raise exception 'NOXIA_TEST_FAIL: failed audit removed the building';
  end if;
  if not exists (
    select 1 from public.entity_states
    where subject_type = 'tile_entity' and subject_id = v_id
      and valid_to is null and valid_from = v_before_state
  ) then
    raise exception 'NOXIA_TEST_FAIL: failed audit closed or altered the current state';
  end if;
  if (select count(*) from public.simulation_events
      where event_type = 'entity.deleted'
        and subject_type = 'tile_entity' and subject_id = v_id) <> v_before_events then
    raise exception 'NOXIA_TEST_FAIL: failed audit left a partial deletion event';
  end if;
  raise notice 'NOXIA_TEST_OK: rejected audit rolls back building DELETE and temporal closure';
end
$test$;

rollback;
