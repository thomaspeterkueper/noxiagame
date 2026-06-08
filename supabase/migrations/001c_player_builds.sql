-- supabase/migrations/001c_player_builds.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- NOXIA — Auftragsbuch (player_builds)
--
-- Ein Vorgang je Zeile. Status-Lebenszyklen:
--   Bau:     building → complete | cancelled
--   Verkauf: selling  → sold
--   (006 ergänzt installing→installed, removing→removed — status ist ein freies
--    TEXT-Feld OHNE CHECK, daher ist dafür kein DDL nötig.)
--
-- MUSS VOR 002 LAUFEN: 002 erweitert diese Tabelle um sale_payout + tile_level,
-- 006 um parent_id/slot/entity_ref. Hier stehen nur die Basisspalten (1–11);
-- die Spalten 12–16 kommen durch 002/006 dazu → reproduziert den Live-Stand.
--
-- Rekonstruiert aus dem laufenden Supabase-Schema. Idempotent — auch gegen die
-- bestehende DB gefahrlos ausführbar (Tabelle/Policy existieren dort bereits).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.player_builds (
  id           uuid        primary key default gen_random_uuid(),
  profile_id   uuid        references public.profiles(id) on delete cascade,
  buildable_id text        not null,
  target_type  text        not null,              -- 'building' | 'ship' | 'module'
  location_id  uuid        references public.locations(id),
  tile_row     integer,
  tile_col     integer,
  status       text        not null default 'building',
  started_at   timestamptz default now(),
  completes_at timestamptz not null,
  created_at   timestamptz default now()
);

alter table public.player_builds enable row level security;

drop policy if exists "Spieler sieht eigene Builds" on public.player_builds;
create policy "Spieler sieht eigene Builds" on public.player_builds
  for all using (auth.uid() = profile_id);

grant all on public.player_builds to service_role;
