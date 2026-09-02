-- NOXIA: atomic resource-flow application for the authoritative tick engine
-- 2026-09-01
--
-- The existing lazy tick engine already owns tick scheduling/idempotency through
-- tick_log + claim_due_ticks(). This migration deliberately does not add a
-- second scheduler or a parallel simulation ledger.
--
-- runPopulationTick updates stock, production and consumption together. A
-- concurrent trade/build operation can otherwise change stock after the tick
-- snapshot was read and before the absolute stock value is written back. The
-- BEFORE UPDATE OF trigger below makes stock application authoritative in
-- PostgreSQL: the row is locked by the UPDATE and the tick delta is always
-- applied to the row's current OLD.stock value.

SET search_path TO public;

CREATE OR REPLACE FUNCTION public.noxia_apply_resource_flow_delta()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- UPDATE acquires the row lock before this trigger runs. Ignore the caller's
  -- precomputed absolute stock and apply the currently declared flow against
  -- the database value that actually won the lock.
  NEW.stock := GREATEST(
    0,
    COALESCE(OLD.stock, 0)
      + COALESCE(NEW.production, 0)
      - COALESCE(NEW.consumption, 0)
  );
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_noxia_apply_resource_flow_delta
  ON public.location_resources;

-- Column-specific UPDATE triggers fire when production/consumption are present
-- in the UPDATE target list, even when the numerical value did not change. That
-- is exactly what the hourly tick does, so every claimed tick applies one delta.
-- Pure stock transfers/build-cost deductions update only stock and therefore do
-- not pass through this trigger or accidentally receive an economy tick.
CREATE TRIGGER trg_noxia_apply_resource_flow_delta
BEFORE UPDATE OF production, consumption
ON public.location_resources
FOR EACH ROW
EXECUTE FUNCTION public.noxia_apply_resource_flow_delta();

COMMENT ON FUNCTION public.noxia_apply_resource_flow_delta() IS
  'Authoritative row-locked application of a NOXIA resource tick: stock := greatest(0, current stock + production - consumption). Tick-slot idempotency remains owned by tick_log/claim_due_ticks().';
