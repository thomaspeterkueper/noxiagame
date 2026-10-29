-- Integration regression for 20261029133000_tile_entity_delete_audit.sql.
-- Run ONLY on a disposable/staging database with a suitable tile_entities fixture:
-- psql -v ON_ERROR_STOP=1 -f supabase/tests/20261029133000_tile_entity_delete_audit.test.sql
-- Explicit transaction rollback ensures no persisted changes on success.
-- A missing fixture is a hard failure: a green test must exercise a real DELETE
-- and an existing current entity_states row. Seed a disposable fixture first.
begin;
do $test$
declare
  v_id uuid;
  v_location uuid;
  v_source_ref text;
  v_before bigint;
  v_event public.simulation_events%rowtype;
  v_trigger_count integer;
  v_state_id uuid;
  v_state_from timestamptz;
  v_closed_at timestamptz;
begin
  select count(*) into v_trigger_count
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname = 'tile_entities'
     and t.tgname = 'noxia_tile_entity_deletion'
     and not t.tgisinternal
     and t.tgenabled <> 'D';
  if v_trigger_count <> 1 then
    raise exception 'NOXIA_TEST_FAIL: DELETE trigger absent or disabled';
  end if;

  -- Use an existing fixture with an open temporal state; otherwise the
  -- deletion test could pass without exercising temporal closure.
  -- The entire transaction is rolled back.
  select te.id, te.location_id, te.source_ref
    into v_id, v_location, v_source_ref
    from public.tile_entities te
   where not exists (
     select 1 from public.person_assignments a where a.tile_entity_id = te.id
   )
     and exists (
       select 1 from public.entity_states es
        where es.subject_type = 'tile_entity' and es.subject_id = te.id
          and es.valid_to is null
     )
   order by te.id
   limit 1
   for update of te;
  if v_id is null then
    raise exception 'NOXIA_TEST_FIXTURE_MISSING: seed a disposable unoccupied tile_entity with current entity_states row';
  end if;

  select id, valid_from into v_state_id, v_state_from
    from public.entity_states
   where subject_type = 'tile_entity' and subject_id = v_id and valid_to is null;
  if v_state_id is null then
    raise exception 'NOXIA_TEST_FIXTURE_MISSING: open temporal state disappeared';
  end if;

  select count(*) into v_before
    from public.simulation_events
   where event_type = 'entity.deleted'
     and subject_type = 'tile_entity'
     and subject_id = v_id
     and metadata->>'source' = 'tile_entities_delete_trigger';

  delete from public.tile_entities where id = v_id;
  if not found then raise exception 'NOXIA_TEST_FAIL: fixture DELETE affected zero rows'; end if;
  select * into v_event
    from public.simulation_events
   where event_type = 'entity.deleted'
     and subject_type = 'tile_entity'
     and subject_id = v_id
     and metadata->>'source' = 'tile_entities_delete_trigger'
   order by created_at desc, id desc
   limit 1;

  if not found then
    raise exception 'NOXIA_TEST_FAIL: DELETE was not recorded';
  end if;
  if (select count(*) from public.simulation_events
       where event_type = 'entity.deleted'
         and subject_type = 'tile_entity'
         and subject_id = v_id
         and metadata->>'source' = 'tile_entities_delete_trigger') <> v_before + 1 then
    raise exception 'NOXIA_TEST_FAIL: DELETE did not emit exactly one event';
  end if;
  if v_event.actor_id is not null
     or v_event.location_id is distinct from v_location
     or v_event.metadata->>'deletion_kind' is distinct from 'unspecified'
     or v_event.effects->0->>'type' is distinct from 'entity_state'
     or v_event.effects->0->'to' is distinct from 'null'::jsonb
     or v_event.effects->0->'from'->>'source_ref' is distinct from v_source_ref then
    raise exception 'NOXIA_TEST_FAIL: event shape or attribution';
  end if;
  if exists (select 1 from public.entity_states
             where subject_type = 'tile_entity'
               and subject_id = v_id and valid_to is null) then
    raise exception 'NOXIA_TEST_FAIL: deleted entity has a current state';
  end if;
  select valid_to into v_closed_at from public.entity_states where id = v_state_id;
  if v_closed_at is null or v_closed_at <= v_state_from
     or v_closed_at is distinct from v_event.occurred_at then
    raise exception 'NOXIA_TEST_FAIL: temporal closure and deletion event timestamp disagree';
  end if;
  raise notice 'NOXIA_TEST_OK: exactly one deletion event and verified temporal closure (transaction rolls back)';
end
$test$;
rollback;
