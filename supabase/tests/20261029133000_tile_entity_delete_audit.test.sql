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
  v_lat double precision;
  v_lon double precision;
  v_width double precision;
  v_depth double precision;
  v_rotation double precision;
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

  -- Require a purchased Earth building (not an arbitrary station entity),
  -- so the regression actually verifies historical OSM/footprint provenance.
  -- The entire transaction is rolled back.
  select te.id, te.location_id, te.source_ref,
         te.latitude_deg, te.longitude_deg,
         te.footprint_width_m, te.footprint_depth_m, te.rotation_deg
    into v_id, v_location, v_source_ref,
         v_lat, v_lon, v_width, v_depth, v_rotation
    from public.tile_entities te
   where te.source_ref ~ '^osm:(way|relation):[0-9]+
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
    raise exception 'NOXIA_TEST_FIXTURE_MISSING: seed an unoccupied purchased Earth building with OSM source_ref, valid footprint and current entity_states row on disposable DB';
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
  -- The historical footprint must be the actual pre-delete building,
  -- not an invented parcel or a refreshed external map geometry.
  if v_event.effects->0->'from'->'latitude_deg' is distinct from to_jsonb(v_lat)
     or v_event.effects->0->'from'->'longitude_deg' is distinct from to_jsonb(v_lon)
     or v_event.effects->0->'from'->'footprint_width_m' is distinct from to_jsonb(v_width)
     or v_event.effects->0->'from'->'footprint_depth_m' is distinct from to_jsonb(v_depth)
     or v_event.effects->0->'from'->'rotation_deg' is distinct from to_jsonb(v_rotation)
     or v_event.effects->0->'from' ? 'parcel_id'
     or v_event.metadata ? 'parcel_id' then
    raise exception 'NOXIA_TEST_FAIL: historical footprint mismatch or fabricated parcel identity';
  end if;
  -- Avoid exporting personal ownership/occupancy identifiers in the audit.
  if v_event.effects->0->'from' ?| array['profile_id','owner_id','occupant_id'] then
    raise exception 'NOXIA_TEST_FAIL: personal ownership/occupancy identifiers leaked';
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
  raise notice 'NOXIA_TEST_OK: Earth building deletion audit, geometry, privacy and temporal closure verified (transaction rolls back)';
end
$test$;
rollback;

     and te.latitude_deg is not null and te.longitude_deg is not null
     and te.footprint_width_m > 0 and te.footprint_depth_m > 0
     and not exists (
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
