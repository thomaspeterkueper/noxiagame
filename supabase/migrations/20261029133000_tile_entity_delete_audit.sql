-- NOXIA Living Future Cities #541: close the DELETE hole in the runtime audit.
-- Draft only: review against a disposable database before applying anywhere.
-- The existing INSERT/UPDATE trigger remains the owner of entity creation/updates.
-- A DELETE is not necessarily a demolition (it may be a cascade or administrative
-- cleanup). This records a DB-observed deletion, NOT a civic permit, command receipt,
-- parcel transition, or an attribution to the former owner.
--
-- Runtime state authority stays with the transaction that DELETEs tile_entities.
-- The trigger and the domain mutation commit or roll back atomically.
set search_path to public;

create or replace function public.noxia_record_tile_entity_deletion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_at timestamptz := clock_timestamp();
  v_previous jsonb;
begin
  -- Keep the previous footprint and imported OSM reference for historical
  -- display, without treating that imported geometry as future world truth.
  v_previous := jsonb_build_object(
    'entity_type', old.entity_type,
    'entity_id', old.entity_id,
    'location_id', old.location_id,
    'tile_level', old.tile_level,
    'tile_row', old.tile_row,
    'tile_col', old.tile_col,
    'owner_class', old.owner_class,
    'condition', old.condition,
    'status', old.status,
    'source_ref', old.source_ref,
    'spatial_region_id', old.spatial_region_id,
    'latitude_deg', old.latitude_deg,
    'longitude_deg', old.longitude_deg,
    'footprint_width_m', old.footprint_width_m,
    'footprint_depth_m', old.footprint_depth_m,
    'rotation_deg', old.rotation_deg
  );

  -- Close any current temporal projection. The one-microsecond floor avoids
  -- violating entity_states_valid_range if a row was created and deleted in
  -- the same transaction (valid_from and now() can otherwise coincide).
  update public.entity_states
     set valid_to = greatest(v_at, valid_from + interval '1 microsecond')
   where subject_type = 'tile_entity'
     and subject_id = old.id
     and valid_to is null
  returning valid_to into v_at;
  if not found then
    v_at := clock_timestamp();
  end if;

  -- Do not claim old.profile_id is the actor: owner != executor, and a
  -- cascade DELETE may have no gameplay actor at all. No parcel_id is
  -- fabricated from source_ref; the canonical binding remains a separate gate.
  insert into public.simulation_events (
    event_type, subject_type, subject_id, actor_id, location_id,
    effects, metadata, occurred_at
  ) values (
    'entity.deleted', 'tile_entity', old.id, null, old.location_id,
    jsonb_build_array(jsonb_build_object(
      'type', 'entity_state', 'from', v_previous, 'to', null
    )),
    jsonb_build_object(
      'source', 'tile_entities_delete_trigger',
      'deletion_kind', 'unspecified',
      'source_ref', old.source_ref
    ),
    v_at
  );
  return old;
end;
$$;

drop trigger if exists noxia_tile_entity_deletion on public.tile_entities;
create trigger noxia_tile_entity_deletion
  after delete on public.tile_entities
  for each row execute function public.noxia_record_tile_entity_deletion();

-- Trigger functions are internal; no direct execution is exposed to API roles.
revoke all on function public.noxia_record_tile_entity_deletion() from public, anon, authenticated;

comment on function public.noxia_record_tile_entity_deletion() is
  'Audit-only DELETE mirror to simulation_events; no demolition authorization or parcel binding.';

-- Preserve the existing service-only runtime stream and RLS configuration.
-- No GRANTs are added to simulation_events or entity_states.
