-- supabase/migrations/014_npc_economy.sql
-- Erstellt:     15.06.2026
-- Aktualisiert: 20.06.2026
-- (Fix: Boann expand.location moon statt mars; ice_drill nur auf Mond erlaubt)
--
-- PHASE C – FUNDAMENT (Schema + Seeds, ohne Ökonomie-Logik).
--
--  1) Eigentum von ZWEI auf DREI Zustände: Spieler (profile_id) | NPC (actor_id)
--     | Station (is_state_owned). Das bestehende owner_xor_state (Spieler XOR
--     Station) wird durch ein Drei-Wege-XOR ersetzt. Non-breaking: das neue
--     Constraint akzeptiert alles, was das alte erlaubte, plus den NPC-Zweig.
--  2) npc_ledger: EIN append-only Event-Log. Lager = Σ goods_delta,
--     Kasse = Σ credit_delta. Idempotenz über Expression-Index.
--  3) Seeds: keltisch benannte Produzenten-NPCs + Gebäude + Startkapital.
--
-- Additiv & idempotent. Spieler-Zeilen, RLS und der laufende HeliosCorp-Kauf
-- (npc_trades) bleiben unberührt. Produktions-/Verkaufs-/Bau-LOGIK folgt separat.

-- ════════════════════════════════════════════════════════════════
-- 1) Eigentum: Spieler | NPC | Station (Drei-Wege-XOR)
-- ════════════════════════════════════════════════════════════════
alter table tile_entities alter column profile_id drop not null;   -- idempotent (bereits nullable)

alter table tile_entities
  add column if not exists actor_id uuid references actors(id) on delete cascade;

-- Genau EIN Eigentümer: Spieler | NPC | Station.
alter table tile_entities drop constraint if exists owner_xor_state;
alter table tile_entities drop constraint if exists tile_owner_xor;
alter table tile_entities add constraint owner_xor_state check (
  (profile_id is not null)::int + (actor_id is not null)::int + (is_state_owned)::int = 1
);

create index if not exists idx_tile_entities_actor
  on tile_entities (actor_id, location_id);

-- ════════════════════════════════════════════════════════════════
-- 2) npc_ledger – ein Topf für Lager UND Kasse
-- ════════════════════════════════════════════════════════════════
create table if not exists npc_ledger (
  id           uuid    primary key default gen_random_uuid(),
  actor_id     uuid    not null references actors(id) on delete cascade,
  tick         bigint  not null,
  kind         text    not null check (kind in ('endowment','produce','buy','sell','build')),
  resource     text,
  goods_delta  numeric not null default 0,
  credit_delta numeric not null default 0,
  location_id  uuid    references locations(id),
  ref          text,
  created_at   timestamptz not null default now()
);

create unique index if not exists uniq_npc_ledger_event
  on npc_ledger (actor_id, tick, kind, coalesce(resource, ''), coalesce(ref, ''));

create index if not exists idx_npc_ledger_actor on npc_ledger (actor_id);

alter table npc_ledger enable row level security;
drop policy if exists npc_ledger_read on npc_ledger;
create policy npc_ledger_read on npc_ledger for select using (true);

-- ════════════════════════════════════════════════════════════════
-- 3) Seeds – keltische Produzenten-NPCs
--
-- Goibniu  – Metall-Produzent, Mond
-- Belenus  – Energie-Produzent, Mars
-- Boann    – Wasser-Produzent, Mond (Eisbohrung — NUR auf Mond erlaubt!)
--
-- HINWEIS: ice_drill hat allowedLocations: ['moon'] in config.ts.
-- Boann bohrt daher auf dem Mond (nicht Mars) und liefert Wasser als
-- Handelsressource. Das schafft einen interessanten Konflikt: Boann
-- konkurriert mit Spielern um Mondeis und liefert ggf. zu Mars.
-- ════════════════════════════════════════════════════════════════
insert into actors (id, kind, display_name, founded_by, bio_short, personality, decision_weights)
values
  ('a0000000-0000-4000-8000-000000000001', 'npc_firm', 'Goibniu', null,
   'Der Schmied — verwandelt Mondgestein in Metall.',
   '{"archetyp":"schmied","geduldig":0.7,"expansiv":0.5}'::jsonb,
   '{"role":"producer","sells":["metal"],"sell_floor":25,"reserve":40,"sell_per_tick":20,"expand":{"building":"mine","location":"moon","cost":1500,"treasury_min":8000}}'::jsonb),
  ('a0000000-0000-4000-8000-000000000002', 'npc_firm', 'Belenus', null,
   'Das Licht — speist die Stationen mit Energie.',
   '{"archetyp":"sonne","geduldig":0.5,"expansiv":0.7}'::jsonb,
   '{"role":"producer","sells":["energy"],"sell_floor":28,"reserve":30,"sell_per_tick":20,"expand":{"building":"solar","location":"mars","cost":1200,"treasury_min":6000}}'::jsonb),
  ('a0000000-0000-4000-8000-000000000003', 'npc_firm', 'Boann', null,
   'Die Quelle — bohrt Wasser aus dem Mondeis, liefert ins Sonnensystem.',
   '{"archetyp":"fluss","geduldig":0.8,"expansiv":0.4}'::jsonb,
   '{"role":"producer","sells":["water"],"sell_floor":40,"reserve":30,"sell_per_tick":20,"expand":{"building":"ice_drill","location":"moon","cost":2500,"treasury_min":9000}}'::jsonb)
on conflict (id) do nothing;

-- Startkapital (endowment, tick 0), idempotent.
insert into npc_ledger (actor_id, tick, kind, credit_delta)
select v.id, 0, 'endowment', v.cap
from (values
  ('a0000000-0000-4000-8000-000000000001'::uuid, 10000),
  ('a0000000-0000-4000-8000-000000000002'::uuid, 10000),
  ('a0000000-0000-4000-8000-000000000003'::uuid, 10000)
) as v(id, cap)
where not exists (select 1 from npc_ledger l where l.actor_id = v.id and l.kind = 'endowment');

-- Startgebäude der Produzenten (actor-eigen: profile_id null, is_state_owned false).
-- Eck-Kacheln, where-not-exists macht den Seed wiederholbar.
-- Goibniu:  Mine auf dem Mond     (row 7, col 11)
-- Belenus:  Solar auf dem Mars    (row 7, col 11)
-- Boann:    Eisbohrung auf Mond   (row 7, col 10) — NICHT Mars
insert into tile_entities (actor_id, location_id, tile_level, tile_row, tile_col, entity_type, entity_id)
select s.actor_id, loc.id, 0, s.row, s.col, 'building', s.entity_id
from (values
  ('a0000000-0000-4000-8000-000000000001'::uuid, 'moon', 7, 11, 'mine'),
  ('a0000000-0000-4000-8000-000000000002'::uuid, 'mars', 7, 11, 'solar'),
  ('a0000000-0000-4000-8000-000000000003'::uuid, 'moon', 7, 10, 'ice_drill')
) as s(actor_id, slug, row, col, entity_id)
join locations loc on loc.slug = s.slug
where not exists (
  select 1 from tile_entities t
  where t.actor_id = s.actor_id and t.location_id = loc.id and t.entity_id = s.entity_id
);

-- Kontrolle:
select a.display_name, te.entity_id, l.slug, te.tile_row, te.tile_col, te.is_state_owned, te.actor_id is not null as is_npc
from tile_entities te
join actors a on a.id = te.actor_id
join locations l on l.id = te.location_id
order by a.display_name;
