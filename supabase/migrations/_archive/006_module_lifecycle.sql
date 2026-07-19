-- supabase/migrations/006_module_lifecycle.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- NOXIA — Modul-Lebenszyklus im Auftragsbuch  (angepasst an den ECHTEN Stand)
--
-- player_builds (real: Basis aus 001c, 002 ergänzt sale_payout + tile_level) HAT bereits:
--   profile_id, buildable_id, target_type ('building'|'ship'|'module'),
--   location_id, tile_level, tile_row, tile_col, status, completes_at, sale_payout.
-- → target_type unterscheidet schon building/ship/MODULE. Es fehlt nur die
--   Slot-Adresse und der Bezug zur betroffenen Zeile. Kein eigenes 'op' nötig:
--   Vorgangsart = target_type, Phase = status (wie building→complete / selling→sold).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Slot-Adresse + Bezug
alter table public.player_builds
  add column if not exists parent_id  uuid,      -- woran das Modul hängt (Schiff/Gebäude)
  add column if not exists slot       smallint,  -- Ziel-(install)/Quell-(remove) Slot
  add column if not exists entity_ref uuid;      -- betroffene tile_entities-Zeile (remove/sell)
-- sale_payout (Bestand) wird wiederverwendet: Bergungs-/Verkaufswert, beim Start fixiert.

-- 2) Status-Set erweitern. 001c bestätigt: status ist eine freie TEXT-Spalte OHNE
--    CHECK. Die neuen Werte installing/installed/removing/removed funktionieren
--    daher ohne jede DDL. → Nichts zu tun.
--    Optional, falls du status später hart validieren willst (ALLE bestehenden
--    Werte müssen dann in der Liste stehen, sonst scheitert das ADD):
-- alter table public.player_builds add constraint player_builds_status_check
--   check (status in (
--     'building','complete','cancelled',   -- Gebäudebau (Bestand)
--     'selling','sold',                    -- Verkauf (Bestand; auch Module)
--     'installing','installed',            -- Modul einbauen (neu)
--     'removing','removed'                 -- Modul ausbauen (neu)
--   ));

-- 3) Indizes
create index if not exists pb_parent_idx on public.player_builds (parent_id);
create index if not exists pb_open_ops_idx on public.player_builds (status)
  where status in ('building','selling','installing','removing');

-- 4) Zustandsautomat (Umsetzung in /api/game/build, analog zu completeBuild/Sale)
--    Die GET-Route schließt fällige Vorgänge bereits ab (status in building/selling).
--    Ergänzen um installing/removing; alle nutzen completes_at + sale_payout:
--
-- INSTALL : insert player_builds(target_type='module', status='installing',
--           buildable_id=moduleId, parent_id, slot, completes_at); Credits −Kosten.
--   fällig: insert tile_entities(parent_id, slot, entity_type='module', entity_id);
--           status='installed'.
-- REMOVE  : insert player_builds(target_type='module', status='removing',
--           entity_ref=modul.id, sale_payout=Bergung, completes_at).
--   fällig: delete tile_entities where id=entity_ref; Credits +sale_payout; status='removed'.
-- SELL    : wie bestehender Gebäude-Verkauf, target_type='module',
--           entity_ref=modul.id, sale_payout=Verkaufswert (zustandsabhängig).
--
-- Beträge & Dauern: lib/game/moduleLifecycle.ts. Beschädigung/Reparatur ändern
-- nur condition/status in tile_entities — keine player_builds-Vorgänge.
