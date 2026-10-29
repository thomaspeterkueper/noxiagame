-- Integration regression for 20261029133000_tile_entity_delete_audit.sql.
-- Run ONLY on a disposable/staging database with a suitable tile_entities fixture:
-- psql -v ON_ERROR_STOP=1 -f supabase/tests/20261029133000_tile_entity_delete_audit.test.sql
-- Explicit transaction rollback ensures no persisted changes on success.
-- A missing fixture is a SKIP (not proof that the runtime trigger works).
begin;
do $test$
declare
  v_id uuid;
  v_location uuid;
  v_source_ref text;
  v_before bigint;
  v_event public.simulation_events%rowtype;
  v_trigger_count integer;
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

  -- Use an existing fixture to avoid assumptions about current tile_entities
  -- defaults/constraints. The entire transaction is rolled back.
  select te.id, te.location_id, te.source_ref
    into v_id, v_location, v_source_ref
    from public.tile_entities te
   where not exists (
     select 1 from public.person_assignments a where a.tile_entity_id = te.id
   )
   order by te.id
   limit 1
   for update of te;
  if v_id is null then
    raise notice 'NOXIA_TEST_SKIPPED: no disposable tile_entity fixture';
    return;
  end if;

  select count(*) into v_before
    from public.simulation_events
   where event_type = 'entity.deleted'
     and subject_type = 'tile_entity'
     and subject_id = v_id
     and metadata->>'source' = 'tile_entities_delete_trigger';

  delete from public.tile_entities where id = v_id;
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
     or v_event.metadata->>'deletion_kind' <> 'unspecified'
     or v_event.effects->0->>'type' <> 'entity_state'
     or v_event.effects->0->'to' <> 'null'::jsonb
     or v_event.effects->0->'from'->>'source_ref' is distinct from v_source_ref then
    raise exception 'NOXIA_TEST_FAIL: event shape or attribution';
  end if;
  if exists (select 1 from public.entity_states
             where subject_type = 'tile_entity'
               and subject_id = v_id and valid_to is null) then
    raise exception 'NOXIA_TEST_FAIL: deleted entity has a current state';
  end if;
  raise notice 'NOXIA_TEST_OK: deletion event and temporal state closure (transaction rolls back)';
end
$test$;
rollback;
