-- supabase/migrations/005_addressable_modules.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- NOXIA — Adressierbare Module / Zellen  (angepasst an den ECHTEN Stand)
--
-- tile_entities (real, aus 002 in Supabase): id, profile_id, location_id,
--   entity_type (TEXT: 'building'|'ship'|… – hält 'building' als String),
--   entity_id, tile_level, tile_row, tile_col.
-- Diese Migration macht daraus einen Entitätsbaum: parent_id + slot, plus
-- condition/status, damit Module eigene adressierbare Zeilen sind.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Neue Spalten
alter table public.tile_entities
  add column if not exists parent_id uuid references public.tile_entities(id) on delete cascade,
  add column if not exists slot      smallint,
  add column if not exists condition smallint not null default 100,  -- 0..100 (Abnutzung)
  add column if not exists status    text     not null default 'active'; -- active|damaged|disabled

-- entity_type hält schon Strings ('building'); 'module' braucht daher KEINE
-- Enum-Änderung. Falls 002 doch einen CHECK/Enum angelegt hat → dort 'module'
-- ergänzen (alter type … add value 'module' bzw. CHECK erweitern).

-- 2) Koordinaten dürfen für Aufsätze (Module) NULL sein
alter table public.tile_entities alter column tile_row    drop not null;
alter table public.tile_entities alter column tile_col    drop not null;
alter table public.tile_entities alter column location_id drop not null;

-- 3) Eindeutigkeit (partielle Indizes)
-- ⚠ Falls 002 einen Unique-Index „ein Gebäude pro Kachel" angelegt hat:
--   echten Namen in Supabase nachsehen und hier droppen.
-- drop index if exists <name_aus_002>;
create unique index if not exists te_building_per_tile
  on public.tile_entities (location_id, tile_level, tile_row, tile_col)
  where entity_type = 'building' and parent_id is null;
create unique index if not exists te_one_per_slot
  on public.tile_entities (parent_id, slot)
  where parent_id is not null;
create index if not exists te_parent_idx on public.tile_entities (parent_id);

-- 4) Integrität: Aufsatz braucht parent+slot; Schiff frei; Gebäude braucht Koordinaten
alter table public.tile_entities drop constraint if exists te_placement_check;
alter table public.tile_entities add constraint te_placement_check check (
      (parent_id is not null and slot is not null)
   or (parent_id is null and entity_type = 'ship')
   or (parent_id is null and tile_row is not null and tile_col is not null)
);

-- 5) RLS: Module liegen in derselben Tabelle → erben die Policies aus 001b/002.
--    ON DELETE CASCADE: Schiff/Gebäude weg → seine Module weg.

-- 6) Naht zum ECHTEN Schiffsmodell (public.ships hat cargo_max flach, ship_cargo
--    je Ressource). Rahmen bekommt einen Anker in tile_entities, Module hängen
--    via parent_id daran. Position/Flug bleibt in public.ships.
alter table public.ships
  add column if not exists frame_entity_id uuid references public.tile_entities(id);
-- Hinweis: ship_type-Enum kennt bisher nur 'freighter'. Für modulare Rahmen
-- (mk1/fast/heavy) trägt der Anker den Rahmen in entity_id; die Enum bleibt
-- unangetastet, bis die Werft-Integration ansteht (größerer Schritt).

-- 7) Backfill-Template: bestehende Schiffe → Anker + Cargo-Module (cargo_max/20)
-- do $$
-- declare r record; new_ship uuid; n int; i int;
-- begin
--   for r in select * from public.ships where frame_entity_id is null loop
--     insert into public.tile_entities (profile_id, entity_type, entity_id)
--       values (r.profile_id, 'ship', 'mk1') returning id into new_ship;
--     update public.ships set frame_entity_id = new_ship where id = r.id;
--     n := greatest(1, round(r.cargo_max / 20.0));   -- MODULE_TONNES = 20
--     for i in 0 .. n-1 loop
--       insert into public.tile_entities (profile_id, parent_id, slot, entity_type, entity_id)
--         values (r.profile_id, new_ship, i, 'module', 'cargo');
--     end loop;
--   end loop;
-- end $$;
