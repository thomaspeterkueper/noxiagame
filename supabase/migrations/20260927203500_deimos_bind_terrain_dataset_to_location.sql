-- Deimos became a playable location after the synthetic terrain scaffold was
-- introduced. The original scaffold intentionally left terrain_datasets.location_id
-- null because no Deimos location row existed yet. Bind the dataset now so the
-- reverse relation matches the world_frame -> terrain_dataset link used by Mars,
-- Moon and Phobos.

UPDATE public.terrain_datasets AS td
SET location_id = l.id
FROM public.locations AS l
WHERE td.id = 'deimos_synthetic_v1'
  AND l.slug = 'deimos'
  AND td.location_id IS NULL;
