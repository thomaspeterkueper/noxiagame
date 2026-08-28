-- NOXIA-LIVING-0001 — production-safe seed guard
-- Ensures the controlled Mars test population exists after schema deployment.
-- Idempotent: fixed UUIDs and ON CONFLICT semantics.

SET search_path TO public;

DO $$
DECLARE
  mars_id uuid;
BEGIN
  IF to_regclass('public.people') IS NULL THEN
    RAISE EXCEPTION 'Living Population schema missing: public.people does not exist';
  END IF;

  SELECT id INTO mars_id FROM public.locations WHERE slug = 'mars' LIMIT 1;
  IF mars_id IS NULL THEN
    RAISE EXCEPTION 'Living Population seed guard: Mars location missing';
  END IF;

  INSERT INTO public.people (id, display_name, birth_year, current_location_id, simulation_tier, activity_state)
  VALUES
    ('51000000-0000-4000-8000-000000000001','Mara Voss',2068,mars_id,'active','idle'),
    ('51000000-0000-4000-8000-000000000002','Kenji Arata',2071,mars_id,'active','idle'),
    ('51000000-0000-4000-8000-000000000003','Lina Okafor',2074,mars_id,'active','idle'),
    ('51000000-0000-4000-8000-000000000004','Samir Haddad',2065,mars_id,'active','idle'),
    ('51000000-0000-4000-8000-000000000005','Elena Ruiz',2077,mars_id,'active','idle'),
    ('51000000-0000-4000-8000-000000000006','Noah Becker',2070,mars_id,'active','idle'),
    ('51000000-0000-4000-8000-000000000007','Asha Menon',2073,mars_id,'active','idle'),
    ('51000000-0000-4000-8000-000000000008','Tomas Eriksen',2066,mars_id,'active','idle')
  ON CONFLICT (id) DO UPDATE SET
    current_location_id = EXCLUDED.current_location_id,
    simulation_tier = EXCLUDED.simulation_tier;
END $$;

-- Fail deployment visibly if the controlled test population is incomplete.
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n
  FROM public.people
  WHERE id::text LIKE '51000000-0000-4000-8000-00000000000%';
  IF n <> 8 THEN
    RAISE EXCEPTION 'Living Population seed guard expected 8 test residents, found %', n;
  END IF;
END $$;
