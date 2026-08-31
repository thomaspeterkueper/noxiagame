-- supabase/migrations/20260719010000_restore_legacy_constraints.sql
-- Restore cross-table constraints for tables precreated ahead of the consolidated
-- 20260719 baseline. Referenced baseline tables exist by the time this runs.

SET search_path TO public;

DO $$ BEGIN
  ALTER TABLE knowledge_transactions
    ADD CONSTRAINT knowledge_transactions_profile_id_fkey
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE kurs_fortschritt
    ADD CONSTRAINT kurs_fortschritt_profile_id_fkey
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE kurs_fortschritt
    ADD CONSTRAINT kurs_fortschritt_kurs_id_fkey
    FOREIGN KEY (kurs_id) REFERENCES foundation_kurse(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE kurs_voraussetzungen
    ADD CONSTRAINT kurs_voraussetzungen_kurs_id_fkey
    FOREIGN KEY (kurs_id) REFERENCES foundation_kurse(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE kurs_voraussetzungen
    ADD CONSTRAINT kurs_voraussetzungen_benoetigt_id_fkey
    FOREIGN KEY (benoetigt_id) REFERENCES foundation_kurse(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE npc_trades
    ADD CONSTRAINT npc_trades_actor_id_fkey
    FOREIGN KEY (actor_id) REFERENCES actors(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE npc_trades
    ADD CONSTRAINT npc_trades_location_id_fkey
    FOREIGN KEY (location_id) REFERENCES locations(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE player_journeys
    ADD CONSTRAINT player_journeys_profile_id_fkey
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT ALL ON public.knowledge_levels TO service_role, authenticated;
GRANT ALL ON public.knowledge_transactions TO service_role, authenticated;
GRANT ALL ON public.kurs_fortschritt TO service_role, authenticated;
GRANT ALL ON public.kurs_voraussetzungen TO service_role, authenticated;
GRANT ALL ON public.npc_trades TO service_role, authenticated;
GRANT ALL ON public.ship_types TO service_role, authenticated;
GRANT ALL ON public.player_journeys TO service_role, authenticated;
GRANT ALL ON public.journey_steps TO service_role, authenticated;
