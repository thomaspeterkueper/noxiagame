-- supabase/migrations/031_reputation_rpc.sql
-- Erstellt:     26.06.2026
-- Aktualisiert: 26.06.2026 — Initiale Version
-- Version:      1.0.0
--
-- Atomare Ruf-Inkrementierung via INSERT ... ON CONFLICT DO UPDATE.
-- Wird von trade/route.ts nach jedem Verkauf aufgerufen.
-- Kein Race-Condition-Problem: UPDATE ist atomar in PostgreSQL.

CREATE OR REPLACE FUNCTION upsert_location_reputation(
  p_profile_id  uuid,
  p_location_id uuid,
  p_deliveries  integer DEFAULT 1,
  p_volume      integer DEFAULT 0
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  INSERT INTO location_reputation (profile_id, location_id, deliveries, total_volume, updated_at)
  VALUES (p_profile_id, p_location_id, p_deliveries, p_volume, now())
  ON CONFLICT (profile_id, location_id) DO UPDATE
    SET deliveries   = location_reputation.deliveries   + p_deliveries,
        total_volume = location_reputation.total_volume + p_volume,
        updated_at   = now();
$$;
