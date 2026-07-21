-- supabase/migrations/20260720110000_npc_rpc.sql
-- RPC für NPC-Tick: increment_stock
-- Erstellt: 20.07.2026

SET search_path TO public;

-- Atomare Stock-Erhöhung/Senkung für NPC-Produktion und -Käufe
CREATE OR REPLACE FUNCTION public.increment_stock(
  p_location_id uuid,
  p_resource    text,
  p_amount      numeric
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.location_resources
  SET    stock = GREATEST(0, stock + p_amount)
  WHERE  location_id = p_location_id
    AND  resource    = p_resource;

  IF NOT FOUND THEN
    INSERT INTO public.location_resources (location_id, resource, stock, production, consumption)
    VALUES (p_location_id, p_resource, GREATEST(0, p_amount), 0, 0)
    ON CONFLICT (location_id, resource) DO UPDATE
      SET stock = GREATEST(0, location_resources.stock + EXCLUDED.stock);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_stock TO service_role;

-- Kontrolle
SELECT proname FROM pg_proc WHERE proname = 'increment_stock';
