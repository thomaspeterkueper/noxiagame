-- Unique world buildings still need display metadata for the existing spatial
-- renderer. The synthetic allowed location deliberately prevents this curated
-- landmark from entering any real player build menu.
insert into public.building_definitions (
  key,
  name,
  description,
  category,
  tier,
  cost_credits,
  build_time_ticks,
  production,
  consumption,
  population_bonus,
  allowed_locations,
  is_active,
  sort_order
) values (
  'ssf_headquarters_sundern',
  'Solar Science Foundation · Hauptsitz',
  'Einzigartiger kanonischer SSF-Hauptsitz in der Bogenstraße 15 in Sundern.',
  'unique',
  1,
  0,
  1,
  '[]'::jsonb,
  '[]'::jsonb,
  0,
  array['canonical_unique']::text[],
  true,
  9999
)
on conflict (key) do update
set name = excluded.name,
    description = excluded.description,
    category = excluded.category,
    allowed_locations = excluded.allowed_locations,
    is_active = true;
