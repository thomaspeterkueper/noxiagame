-- NOXIA-LIVING — Q1 canon location and Tirin Kal identity bridge.
-- Q1 is heliocentric; legacy planet-centric orbit_class/orbit_altitude_km stay NULL.

DO $$
DECLARE
  v_q1_id uuid;
  v_tirin_id uuid;
BEGIN
  INSERT INTO public.locations (
    slug, name, description, population, population_max, growth_rate, decline_rate,
    is_supplied, has_shipyard, simulate_tick, location_type, celestial_body_id,
    surface_lat, surface_lon, grid_radius, orbit_altitude_km, orbit_inclination,
    orbit_class, founded_at, is_public
  ) VALUES (
    'q1',
    'Q1 / Mars-Quadraturstation',
    'Älteste heliozentrische Quadraturstation auf annähernd Marsbahnhöhe; um 2150 eine kleine, stark automatisierte Stadt.',
    3250, 5000, 0, 0, true, true, false, 'station', null,
    null, null, 12, null, null, null, null, true
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    population = EXCLUDED.population,
    population_max = EXCLUDED.population_max,
    is_supplied = EXCLUDED.is_supplied,
    has_shipyard = EXCLUDED.has_shipyard,
    location_type = EXCLUDED.location_type,
    celestial_body_id = null,
    surface_lat = null,
    surface_lon = null,
    orbit_altitude_km = null,
    orbit_inclination = null,
    orbit_class = null,
    updated_at = now()
  RETURNING id INTO v_q1_id;

  INSERT INTO public.people (
    person_key, display_name, birth_year, current_location_id, simulation_tier,
    activity_state, last_action, last_decision_factors, last_tick,
    bio_short, public_role, traits, external_person_ref
  ) VALUES (
    'tirin-kal', 'Tirin Kal', null, v_q1_id, 'background',
    'idle', null, '{"seed":"NOXIA-TIRIN-Q1","canon_boundary":"identity-only"}'::jsonb, null,
    'Autor und Chronist des frühen X-Zeitalters; lebt um 2150 auf Q1.',
    'author_chronicler',
    '{"observant":true,"patient":true,"independent":true,"canon_status":"working"}'::jsonb,
    'noxia:character:tirin-kal'
  )
  ON CONFLICT (person_key) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    current_location_id = EXCLUDED.current_location_id,
    simulation_tier = EXCLUDED.simulation_tier,
    bio_short = EXCLUDED.bio_short,
    public_role = EXCLUDED.public_role,
    traits = EXCLUDED.traits,
    external_person_ref = EXCLUDED.external_person_ref,
    updated_at = now()
  RETURNING id INTO v_tirin_id;

  INSERT INTO public.person_canonical_characters (
    person_id, universe_key, character_key, canon_source_ref, canon_revision,
    integration_mode
  ) VALUES (
    v_tirin_id,
    'noxia',
    'tirin-kal',
    'NOXIA – Tirin Kal – Charakterdossier',
    'v1.2',
    'canon_anchor'
  )
  ON CONFLICT (person_id) DO UPDATE SET
    universe_key = EXCLUDED.universe_key,
    character_key = EXCLUDED.character_key,
    canon_source_ref = EXCLUDED.canon_source_ref,
    canon_revision = EXCLUDED.canon_revision,
    integration_mode = EXCLUDED.integration_mode;
END $$;

DO $$
DECLARE
  v_q1 uuid := (SELECT id FROM public.locations WHERE slug='q1');
  v_tirin uuid := (SELECT id FROM public.people WHERE person_key='tirin-kal');
BEGIN
  IF v_q1 IS NULL THEN RAISE EXCEPTION 'Q1 location missing'; END IF;
  IF v_tirin IS NULL THEN RAISE EXCEPTION 'Tirin Kal person missing'; END IF;
  IF (SELECT current_location_id FROM public.people WHERE id=v_tirin) <> v_q1 THEN
    RAISE EXCEPTION 'Tirin Kal is not located at Q1';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.person_canonical_characters
    WHERE person_id=v_tirin AND universe_key='noxia' AND character_key='tirin-kal'
      AND integration_mode='canon_anchor'
  ) THEN RAISE EXCEPTION 'Tirin Kal canon bridge missing'; END IF;
END $$;
