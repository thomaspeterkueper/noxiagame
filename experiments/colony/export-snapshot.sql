-- Read-only export of the active living population as a research snapshot.
-- Run in the Supabase SQL editor, save the single JSON cell as
-- experiments/colony/<name>.snapshot.json and pass it to
--   npm run research:colony -- --snapshot experiments/colony/<name>.snapshot.json
select json_build_object(
  'people', (
    select json_agg(json_build_object(
      'id', p.id,
      'named', p.person_key is not null,
      'locationId', p.current_location_id,
      'traits', coalesce(p.traits, '{}'::jsonb),
      'needs', (select json_object_agg(n.need_code, n.satisfaction) from public.person_needs n where n.person_id = p.id),
      'assignments', (select json_agg(json_build_object('type', a.assignment_type, 'locationId', a.location_id, 'tileEntityId', a.tile_entity_id))
                      from public.person_assignments a where a.person_id = p.id and a.is_active)
    ) order by p.id)
    from public.people p where p.simulation_tier = 'active'),
  'relationships', (
    select json_agg(json_build_object(
      'personId', r.person_id, 'otherPersonId', r.other_person_id, 'familiarity', r.familiarity,
      'trust', r.trust, 'affinity', r.affinity, 'lastInteractionTick', r.last_interaction_tick))
    from public.person_relationships r
    join public.people p on p.id = r.person_id
    join public.people o on o.id = r.other_person_id
    where p.simulation_tier = 'active' and o.simulation_tier = 'active'),
  'tick', (select max(tick_number) from public.tick_log)
) as snapshot;
