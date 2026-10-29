-- Temporal-boundary regression for the DELETE audit (#541).
-- Disposable PostgreSQL fixture only; a deliberately future-dated valid_from
-- forces the one-microsecond floor even when the DB clock has not advanced.
-- This tests range integrity, not a legitimate future gameplay event.
begin;
do $test$
declare
  v_id uuid := '00000000-0000-4000-8000-000000000001';
  v_from timestamptz;
  v_closed timestamptz;
  v_event_at timestamptz;
  v_event_count integer;
begin
  if not exists (
    select 1 from public.tile_entities
    where id = v_id and entity_type = 'building'
      and source_ref = 'osm:way:1234567'
  ) then
    raise exception 'NOXIA_TEST_FIXTURE_MISSING: Earth building for temporal-boundary regression';
  end if;

  update public.entity_states
     set valid_from = clock_timestamp() + interval '1 hour'
   where subject_type = 'tile_entity'
     and subject_id = v_id
     and valid_to is null
  returning valid_from into v_from;
  if not found or v_from <= clock_timestamp() then
    raise exception 'NOXIA_TEST_FIXTURE_MISSING: open future-dated temporal state';
  end if;

  delete from public.tile_entities where id = v_id;
  if not found then
    raise exception 'NOXIA_TEST_FAIL: temporal-boundary DELETE affected zero rows';
  end if;

  select valid_to into v_closed
    from public.entity_states
   where subject_type = 'tile_entity' and subject_id = v_id;
  select count(*), max(occurred_at) into v_event_count, v_event_at
    from public.simulation_events
   where event_type = 'entity.deleted'
     and subject_type = 'tile_entity' and subject_id = v_id
     and metadata->>'source' = 'tile_entities_delete_trigger';

  if v_event_count <> 1
     or v_closed is distinct from v_from + interval '1 microsecond'
     or v_event_at is distinct from v_closed then
    raise exception 'NOXIA_TEST_FAIL: temporal floor/event time mismatch (events %, from %, closed %, event %)',
      v_event_count, v_from, v_closed, v_event_at;
  end if;

  raise notice 'NOXIA_TEST_OK: temporal floor closes range and event at identical timestamp';
end
$test$;
rollback;
