-- NOXIA: authoritative resource costs for building starts
-- 2026-08-31
--
-- Resource costs must not depend on the browser or API caller.  The build API
-- already inserts into player_builds as the authoritative start boundary, so a
-- BEFORE INSERT trigger is the narrowest place to enforce and consume stocks.
-- The trigger transaction rolls back the stock deduction if the build insert
-- fails for any reason.

SET search_path TO public;

CREATE TABLE IF NOT EXISTS public.building_resource_costs (
  buildable_id text NOT NULL,
  resource resource_type NOT NULL,
  amount integer NOT NULL CHECK (amount > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (buildable_id, resource)
);

COMMENT ON TABLE public.building_resource_costs IS
  'Authoritative NOXIA material/resource costs consumed when a building start is inserted into player_builds.';

-- Mirror the currently established NOXIA building costs.  ON CONFLICT updates
-- make this migration safe when a preview branch already contains the rows.
INSERT INTO public.building_resource_costs (buildable_id, resource, amount)
VALUES
  ('residential_block', 'components'::resource_type, 10),
  ('laboratory',        'components'::resource_type, 15),
  ('factory',           'components'::resource_type, 5)
ON CONFLICT (buildable_id, resource)
DO UPDATE SET amount = EXCLUDED.amount, updated_at = now();

CREATE OR REPLACE FUNCTION public.noxia_consume_build_resources()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cost record;
  v_stock integer;
BEGIN
  -- Sales, ships and station modules are not normal surface building starts.
  IF NEW.target_type IS DISTINCT FROM 'building'
     OR NEW.status IS DISTINCT FROM 'building' THEN
    RETURN NEW;
  END IF;

  IF NEW.location_id IS NULL THEN
    RAISE EXCEPTION 'NOXIA_BUILD_LOCATION_REQUIRED'
      USING ERRCODE = 'P0001';
  END IF;

  FOR v_cost IN
    SELECT resource, amount
    FROM public.building_resource_costs
    WHERE buildable_id = NEW.buildable_id
    ORDER BY resource
  LOOP
    -- Lock each stock row until this transaction finishes.  This prevents two
    -- concurrent build starts from both passing the same stock check.
    SELECT stock
      INTO v_stock
      FROM public.location_resources
     WHERE location_id = NEW.location_id
       AND resource = v_cost.resource
     FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'NOXIA_BUILD_RESOURCE_MISSING:%', v_cost.resource
        USING ERRCODE = 'P0001';
    END IF;

    IF v_stock < v_cost.amount THEN
      RAISE EXCEPTION 'NOXIA_BUILD_RESOURCE_INSUFFICIENT:%:%:%',
        v_cost.resource, v_stock, v_cost.amount
        USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.location_resources
       SET stock = stock - v_cost.amount,
           updated_at = now()
     WHERE location_id = NEW.location_id
       AND resource = v_cost.resource;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_noxia_consume_build_resources ON public.player_builds;
CREATE TRIGGER trg_noxia_consume_build_resources
BEFORE INSERT ON public.player_builds
FOR EACH ROW
EXECUTE FUNCTION public.noxia_consume_build_resources();

-- This table is configuration, not player-writeable state.  Keep writes behind
-- service-role / migrations. Authenticated clients may read costs for display.
ALTER TABLE public.building_resource_costs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS building_resource_costs_read ON public.building_resource_costs;
CREATE POLICY building_resource_costs_read
ON public.building_resource_costs
FOR SELECT
TO authenticated
USING (true);

GRANT SELECT ON public.building_resource_costs TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.building_resource_costs FROM anon, authenticated;

COMMENT ON FUNCTION public.noxia_consume_build_resources() IS
  'Consumes authoritative location resource costs atomically with a player_builds building-start insert.';
