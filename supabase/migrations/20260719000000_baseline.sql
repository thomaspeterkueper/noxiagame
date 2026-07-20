-- supabase/migrations/20260719000000_baseline.sql
-- NOXIA Datenbank-Baseline — Stand: 19.07.2026 (Updated: 20.07.2026)
-- v1.2: CREATE EXTENSION IF NOT EXISTS, alle Indizes IF NOT EXISTS
-- Quelle: DB-Schema-Export + Migration-Archiv (001a–034)
--
-- Ausführen auf LEERER Datenbank.
-- Bestehende DB: nicht ausführen (Schema bereits vorhanden).
-- Vorherige Migrations sind in supabase/migrations/_archive/ archiviert.

SET search_path TO public;

-- ════════════════════════════════════
-- EXTENSIONS
-- ════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ════════════════════════════════════
-- ENUMS
-- ════════════════════════════════════
DO $$ BEGIN
  CREATE TYPE resource_type AS ENUM ('water','energy','metal','ice','wolfram');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM ('open','fulfilled','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ════════════════════════════════════
-- SEQUENCES
-- ════════════════════════════════════
CREATE SEQUENCE IF NOT EXISTS colony_ledger_id_seq;
CREATE SEQUENCE IF NOT EXISTS events_id_seq;

-- ════════════════════════════════════
-- TABLES (aus CSV-Export)
-- ════════════════════════════════════

-- academy_completions
CREATE TABLE IF NOT EXISTS academy_completions (
  id                               uuid DEFAULT gen_random_uuid() NOT NULL,
  profile_id                       uuid NOT NULL,
  module_id                        text NOT NULL,
  completed_at                     timestamptz DEFAULT now() NOT NULL,
  points_earned                    integer DEFAULT 0 NOT NULL
);

-- academy_modules
CREATE TABLE IF NOT EXISTS academy_modules (
  id                               text NOT NULL,
  name                             text NOT NULL,
  description                      text,
  topic                            text NOT NULL,
  tier                             integer DEFAULT 0 NOT NULL,
  created_at                       timestamptz DEFAULT now() NOT NULL
);

-- actors
CREATE TABLE IF NOT EXISTS actors (
  id                               uuid DEFAULT gen_random_uuid() NOT NULL,
  kind                             text NOT NULL,
  display_name                     text NOT NULL,
  founded_by                       uuid,
  bio_short                        text,
  personality                      jsonb,
  decision_weights                 jsonb,
  created_at                       timestamptz DEFAULT now() NOT NULL
);

-- building_definitions
CREATE TABLE IF NOT EXISTS building_definitions (
  key                              text NOT NULL,
  name                             text NOT NULL,
  description                      text DEFAULT ''::text NOT NULL,
  category                         text DEFAULT 'extraction'::text NOT NULL,
  tier                             integer DEFAULT 1 NOT NULL,
  cost_credits                     integer DEFAULT 0 NOT NULL,
  build_time_ticks                 integer DEFAULT 1 NOT NULL,
  production                       jsonb DEFAULT '[]'::jsonb NOT NULL,
  consumption                      jsonb DEFAULT '[]'::jsonb NOT NULL,
  population_bonus                 integer DEFAULT 0 NOT NULL,
  allowed_locations                text[],
  requires_building                text,
  requires_tier                    integer,
  sale_base_cost                   integer,
  is_active                        boolean DEFAULT true NOT NULL,
  sort_order                       integer DEFAULT 0 NOT NULL,
  created_at                       timestamptz DEFAULT now() NOT NULL
);

-- buildings
CREATE TABLE IF NOT EXISTS buildings (
  type                             text NOT NULL,
  label                            text NOT NULL,
  description                      text,
  cost_credits                     integer NOT NULL,
  effect_resource                  text,
  effect_amount                    integer,
  population_bonus                 integer
);

-- colony_ledger
CREATE TABLE IF NOT EXISTS colony_ledger (
  id                               bigint DEFAULT nextval('colony_ledger_id_seq'::regclass) NOT NULL,
  location_id                      uuid NOT NULL,
  tick                             bigint NOT NULL,
  entry_type                       text NOT NULL,
  profile_id                       uuid,
  resource_type                    text,
  amount                           numeric NOT NULL,
  note                             text,
  created_at                       timestamptz DEFAULT now() NOT NULL
);

-- colony_settings
CREATE TABLE IF NOT EXISTS colony_settings (
  location_id                      uuid NOT NULL,
  tax_property                     numeric DEFAULT 0 NOT NULL,
  tax_transaction                  numeric DEFAULT 0 NOT NULL,
  tax_landing                      numeric DEFAULT 0 NOT NULL,
  updated_at                       timestamptz DEFAULT now() NOT NULL,
  updated_by                       uuid
);

-- colony_tariffs
CREATE TABLE IF NOT EXISTS colony_tariffs (
  location_id                      uuid NOT NULL,
  resource_type                    text NOT NULL,
  rate                             numeric DEFAULT 0 NOT NULL,
  updated_at                       timestamptz DEFAULT now() NOT NULL,
  updated_by                       uuid
);

-- daily_tasks
CREATE TABLE IF NOT EXISTS daily_tasks (
  id                               uuid DEFAULT gen_random_uuid() NOT NULL,
  profile_id                       uuid NOT NULL,
  task_date                        date DEFAULT CURRENT_DATE NOT NULL,
  completed                        boolean DEFAULT false NOT NULL,
  points_earned                    integer,
  created_at                       timestamptz DEFAULT now() NOT NULL
);

-- events
CREATE TABLE IF NOT EXISTS events (
  id                               bigint DEFAULT nextval('events_id_seq'::regclass) NOT NULL,
  profile_id                       uuid,
  location_id                      uuid,
  type                             text NOT NULL,
  payload                          jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at                       timestamptz DEFAULT now() NOT NULL
);

-- foundation_folien
CREATE TABLE IF NOT EXISTS foundation_folien (
  id                               uuid DEFAULT gen_random_uuid() NOT NULL,
  kurs_id                          uuid NOT NULL,
  position                         integer NOT NULL,
  typ                              text NOT NULL,
  titel                            text,
  inhalt                           jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at                       timestamptz DEFAULT now() NOT NULL
);

-- foundation_kurse
CREATE TABLE IF NOT EXISTS foundation_kurse (
  id                               uuid DEFAULT gen_random_uuid() NOT NULL,
  kurs_id                          text NOT NULL,
  titel                            text NOT NULL,
  untertitel                       text,
  beschreibung                     text,
  niveau                           integer DEFAULT 1 NOT NULL,
  thema                            text DEFAULT 'Mathematik'::text NOT NULL,
  thema_farbe                      text DEFAULT '#1a4e8a'::text NOT NULL,
  dauer_min                        integer,
  punkte                           integer DEFAULT 50 NOT NULL,
  published                        boolean DEFAULT false NOT NULL,
  sort_order                       integer DEFAULT 0 NOT NULL,
  created_at                       timestamptz DEFAULT now() NOT NULL,
  kg_path_id                       text
);

-- friendships
CREATE TABLE IF NOT EXISTS friendships (
  id                               uuid DEFAULT gen_random_uuid() NOT NULL,
  profile_id                       uuid NOT NULL,
  friend_id                        uuid NOT NULL,
  status                           text DEFAULT 'pending'::text NOT NULL
);

-- ════════════════════════════════════
-- TABLES (aus Migrations-Archiv)
-- ════════════════════════════════════

CREATE TABLE IF NOT EXISTS profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text not null unique
                 constraint username_length check (char_length(username) between 3 and 24),
  credits      integer not null default 5000
                 constraint credits_positive check (credits >= 0),
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS locations (
  id             uuid primary key default uuid_generate_v4(),
  slug           text not null unique,
  name           text not null,
  description    text,
  population     integer not null default 0
                   constraint population_non_negative check (population >= 0),
  population_max integer not null default 1000
                   constraint population_max_positive check (population_max > 0),
  growth_rate    numeric(5,4) not null default 0.0100,
  decline_rate   numeric(5,4) not null default 0.0200,
  is_supplied    boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint population_within_max check (population <= population_max)
);

CREATE TABLE IF NOT EXISTS resources (
  type  resource_type primary key,
  label text not null,
  unit  text not null default 't'
);

CREATE TABLE IF NOT EXISTS location_resources (
  id          uuid primary key default uuid_generate_v4(),
  location_id uuid not null references public.locations(id) on delete cascade,
  resource    resource_type not null,
  stock       integer not null default 0 constraint stock_non_negative check (stock >= 0),
  consumption integer not null default 0,
  production  integer not null default 0,
  updated_at  timestamptz not null default now(),
  unique (location_id, resource)
);

CREATE TABLE IF NOT EXISTS player_buildings (
  id          uuid primary key default uuid_generate_v4(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  building    building_type not null,
  built_at    timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS ships (
  id            uuid primary key default uuid_generate_v4(),
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  name          text not null default 'Frachter Mk.I',
  type          ship_type not null default 'freighter',
  cargo_max     integer not null default 100 constraint cargo_max_positive check (cargo_max > 0),
  location      text not null default 'moon',
  status        ship_status not null default 'docked',
  dest_location text,
  arrives_at    timestamptz,
  created_at    timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS ship_cargo (
  id       uuid primary key default uuid_generate_v4(),
  ship_id  uuid not null references public.ships(id) on delete cascade,
  resource resource_type not null,
  amount   integer not null constraint amount_positive check (amount > 0),
  unique (ship_id, resource)
);

CREATE TABLE IF NOT EXISTS market_prices (
  id          uuid primary key default uuid_generate_v4(),
  location_id uuid not null references public.locations(id) on delete cascade,
  resource    resource_type not null,
  buy_price   integer not null constraint buy_positive check (buy_price > 0),
  sell_price  integer not null constraint sell_positive check (sell_price > 0),
  constraint  sell_below_buy check (sell_price < buy_price),
  updated_at  timestamptz not null default now(),
  unique (location_id, resource)
);

CREATE TABLE IF NOT EXISTS trade_orders (
  id           uuid primary key default uuid_generate_v4(),
  location_id  uuid not null references public.locations(id) on delete cascade,
  resource     resource_type not null,
  amount       integer not null constraint amount_positive check (amount > 0),
  reward       integer not null constraint reward_positive check (reward > 0),
  status       order_status not null default 'open',
  fulfilled_by uuid references public.profiles(id),
  expires_at   timestamptz not null default now() + interval '24 hours',
  created_at   timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS trade_transactions (
  id            uuid primary key default uuid_generate_v4(),
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  from_location text not null,
  to_location   text not null,
  resource      resource_type not null,
  amount        integer not null constraint amount_positive check (amount > 0),
  profit        integer not null,
  order_id      uuid references public.trade_orders(id),
  traded_at     timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS world_events (
  id          uuid primary key default uuid_generate_v4(),
  location_id uuid references public.locations(id) on delete cascade,
  type        event_type not null,
  description text not null,
  effect      jsonb not null default '{}',
  active      boolean not null default true,
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz not null default now() + interval '6 hours',
  created_at  timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS historical_milestones (
  id          uuid primary key default uuid_generate_v4(),
  type        text not null,
  description text not null,
  profile_id  uuid references public.profiles(id),
  data        jsonb not null default '{}',
  achieved_at timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS simulation_ticks (
  id          uuid primary key default uuid_generate_v4(),
  tick_number bigint not null,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms integer,
  summary     jsonb not null default '{}'
);

CREATE TABLE IF NOT EXISTS player_builds (
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

CREATE TABLE IF NOT EXISTS tile_entities (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  location_id  uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  tile_level   smallint NOT NULL DEFAULT 0,
  tile_row     smallint NOT NULL,
  tile_col     smallint NOT NULL,
  entity_type  text NOT NULL DEFAULT 'building',
  entity_id    text NOT NULL,
  built_at     timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT tile_level_valid  CHECK (tile_level BETWEEN -3 AND 0),
  CONSTRAINT entity_type_valid CHECK (entity_type IN ('building','vehicle','specialist','ship'))
);

CREATE TABLE IF NOT EXISTS tick_log (
  tick_number bigint PRIMARY KEY,
  tick_type   text NOT NULL DEFAULT 'full',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS price_history (
  id          bigserial PRIMARY KEY,
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  resource    text NOT NULL,
  tick_number bigint NOT NULL,
  buy_price   integer NOT NULL,
  sell_price  integer NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS npc_ledger (
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

CREATE TABLE IF NOT EXISTS bank_accounts (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location_id  uuid        NOT NULL REFERENCES locations(id)  ON DELETE CASCADE,
  deposit      numeric     NOT NULL DEFAULT 0 CHECK (deposit >= 0),
  loan         numeric     NOT NULL DEFAULT 0 CHECK (loan    >= 0),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  UNIQUE (profile_id, location_id)
);

CREATE TABLE IF NOT EXISTS bank_ledger (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location_id   uuid        NOT NULL REFERENCES locations(id)  ON DELETE CASCADE,
  entry_type    text        NOT NULL CHECK (entry_type IN (
                              'deposit',       -- Einzahlung
                              'withdrawal',    -- Auszahlung
                              'loan_taken',    -- Kredit aufgenommen
                              'loan_repaid',   -- Kredit getilgt
                              'interest_deposit', -- Zinsgutschrift auf Einlage
                              'interest_loan'     -- Zinslast auf Kredit
                            )),
  amount        numeric     NOT NULL CHECK (amount > 0),
  balance_after numeric     NOT NULL,  -- Snapshot Einlage oder Kredit nach Buchung
  note          text,
  tick          integer,               -- Tick-Nummer bei Zins-Buchungen
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS location_reputation (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  location_id  uuid        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  deliveries   integer     NOT NULL DEFAULT 0,   -- Anzahl Lieferungen
  total_volume integer     NOT NULL DEFAULT 0,   -- Gesamtvolumen in Tonnen
  updated_at   timestamptz NOT NULL DEFAULT now(),

  UNIQUE (profile_id, location_id)
);

CREATE TABLE IF NOT EXISTS player_learning_progress (
  profile_id uuid not null references profiles(id) on delete cascade,
  module_id text not null,
  progress_percent integer not null default 0,
  completed boolean not null default false,
  completed_at timestamptz,
  knowledge_awarded integer not null default 0,
  unlock_awarded boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (profile_id, module_id)
);

-- ════════════════════════════════════
-- INDEXES
-- ════════════════════════════════════

CREATE UNIQUE INDEX IF NOT EXISTS academy_completions_pkey ON public.academy_completions USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS academy_completions_profile_id_module_id_key ON public.academy_completions USING btree (profile_id, module_id);

CREATE INDEX IF NOT EXISTS idx_academy_completions_profile ON public.academy_completions USING btree (profile_id, module_id);

CREATE UNIQUE INDEX IF NOT EXISTS academy_modules_pkey ON public.academy_modules USING btree (id);

CREATE INDEX IF NOT EXISTS actors_founded_by ON public.actors USING btree (founded_by) WHERE (founded_by IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS actors_pkey ON public.actors USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS building_definitions_pkey ON public.building_definitions USING btree (key);

CREATE UNIQUE INDEX IF NOT EXISTS buildings_pkey ON public.buildings USING btree (type);

CREATE INDEX IF NOT EXISTS colony_ledger_location_tick ON public.colony_ledger USING btree (location_id, tick DESC);

CREATE UNIQUE INDEX IF NOT EXISTS colony_ledger_pkey ON public.colony_ledger USING btree (id);

CREATE INDEX IF NOT EXISTS colony_ledger_profile ON public.colony_ledger USING btree (profile_id) WHERE (profile_id IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS colony_ledger_tax_property_once ON public.colony_ledger USING btree (location_id, profile_id, tick) WHERE (entry_type = 'tax_property'::text);

CREATE UNIQUE INDEX IF NOT EXISTS colony_settings_pkey ON public.colony_settings USING btree (location_id);

CREATE UNIQUE INDEX IF NOT EXISTS colony_tariffs_pkey ON public.colony_tariffs USING btree (location_id, resource_type);

CREATE UNIQUE INDEX IF NOT EXISTS daily_tasks_pkey ON public.daily_tasks USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS daily_tasks_profile_id_task_date_key ON public.daily_tasks USING btree (profile_id, task_date);

CREATE INDEX IF NOT EXISTS idx_daily_tasks_profile ON public.daily_tasks USING btree (profile_id, task_date DESC);

CREATE UNIQUE INDEX IF NOT EXISTS events_pkey ON public.events USING btree (id);

CREATE INDEX IF NOT EXISTS idx_events_location ON public.events USING btree (location_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_events_profile ON public.events USING btree (profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_events_type ON public.events USING btree (type, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS foundation_folien_kurs_id_position_key ON public.foundation_folien USING btree (kurs_id, "position");

CREATE UNIQUE INDEX IF NOT EXISTS foundation_folien_pkey ON public.foundation_folien USING btree (id);

CREATE INDEX IF NOT EXISTS idx_foundation_folien_kurs ON public.foundation_folien USING btree (kurs_id, "position");

CREATE UNIQUE INDEX IF NOT EXISTS foundation_kurse_kurs_id_key ON public.foundation_kurse USING btree (kurs_id);

CREATE UNIQUE INDEX IF NOT EXISTS foundation_kurse_pkey ON public.foundation_kurse USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS friendships_pkey ON public.friendships USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS friendships_profile_id_friend_id_key ON public.friendships USING btree (profile_id, friend_id);

CREATE INDEX IF NOT EXISTS idx_friendships_friend ON public.friendships USING btree (friend_id, status);

CREATE INDEX IF NOT EXISTS idx_friendships_profile ON public.friendships USING btree (profile_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS historical_milestones_pkey ON public.historical_milestones USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS journey_steps_pkey ON public.journey_steps USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS knowledge_levels_pkey ON public.knowledge_levels USING btree (level);

CREATE INDEX IF NOT EXISTS idx_knowledge_tx_profile ON public.knowledge_transactions USING btree (profile_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS knowledge_transactions_pkey ON public.knowledge_transactions USING btree (id);

CREATE INDEX IF NOT EXISTS idx_kurs_fortschritt_profile ON public.kurs_fortschritt USING btree (profile_id);

CREATE UNIQUE INDEX IF NOT EXISTS kurs_fortschritt_pkey ON public.kurs_fortschritt USING btree (profile_id, kurs_id);

CREATE UNIQUE INDEX IF NOT EXISTS kurs_voraussetzungen_pkey ON public.kurs_voraussetzungen USING btree (kurs_id, benoetigt_id);

CREATE INDEX IF NOT EXISTS idx_location_reputation_profile ON public.location_reputation USING btree (profile_id);

CREATE UNIQUE INDEX IF NOT EXISTS location_reputation_pkey ON public.location_reputation USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS location_reputation_profile_id_location_id_key ON public.location_reputation USING btree (profile_id, location_id);

CREATE INDEX IF NOT EXISTS idx_location_resources_location ON public.location_resources USING btree (location_id);

CREATE UNIQUE INDEX IF NOT EXISTS location_resources_location_id_resource_key ON public.location_resources USING btree (location_id, resource);

CREATE UNIQUE INDEX IF NOT EXISTS location_resources_pkey ON public.location_resources USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS locations_pkey ON public.locations USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS locations_slug_key ON public.locations USING btree (slug);

CREATE INDEX IF NOT EXISTS idx_market_prices_location ON public.market_prices USING btree (location_id);

CREATE UNIQUE INDEX IF NOT EXISTS market_prices_location_id_resource_key ON public.market_prices USING btree (location_id, resource);

CREATE UNIQUE INDEX IF NOT EXISTS market_prices_pkey ON public.market_prices USING btree (id);

CREATE INDEX IF NOT EXISTS idx_npc_ledger_actor ON public.npc_ledger USING btree (actor_id);

CREATE UNIQUE INDEX IF NOT EXISTS npc_ledger_pkey ON public.npc_ledger USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_npc_ledger_event ON public.npc_ledger USING btree (actor_id, tick, kind, COALESCE(resource, ''::text), COALESCE(ref, ''::text));

CREATE UNIQUE INDEX IF NOT EXISTS npc_trades_actor_id_tick_resource_key ON public.npc_trades USING btree (actor_id, tick, resource);

CREATE INDEX IF NOT EXISTS npc_trades_actor_resource ON public.npc_trades USING btree (actor_id, resource);

CREATE UNIQUE INDEX IF NOT EXISTS npc_trades_pkey ON public.npc_trades USING btree (id);

CREATE INDEX IF NOT EXISTS idx_player_buildings_location ON public.player_buildings USING btree (location_id);

CREATE INDEX IF NOT EXISTS idx_player_buildings_profile ON public.player_buildings USING btree (profile_id);

CREATE UNIQUE INDEX IF NOT EXISTS player_buildings_pkey ON public.player_buildings USING btree (id);

CREATE INDEX IF NOT EXISTS pb_open_ops_idx ON public.player_builds USING btree (status) WHERE (status = ANY (ARRAY['building'::text, 'selling'::text, 'installing'::text, 'removing'::text]));

CREATE INDEX IF NOT EXISTS pb_parent_idx ON public.player_builds USING btree (parent_id);

CREATE UNIQUE INDEX IF NOT EXISTS player_builds_pkey ON public.player_builds USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS player_journeys_pkey ON public.player_journeys USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS player_journeys_profile_id_journey_key_key ON public.player_journeys USING btree (profile_id, journey_key);

CREATE INDEX IF NOT EXISTS idx_price_history_lookup ON public.price_history USING btree (location_id, resource, tick_number DESC);

CREATE UNIQUE INDEX IF NOT EXISTS price_history_pkey ON public.price_history USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_pkey ON public.profiles USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_key ON public.profiles USING btree (username);

CREATE UNIQUE INDEX IF NOT EXISTS resources_pkey ON public.resources USING btree (type);

CREATE INDEX IF NOT EXISTS idx_ship_cargo_ship ON public.ship_cargo USING btree (ship_id);

CREATE UNIQUE INDEX IF NOT EXISTS ship_cargo_pkey ON public.ship_cargo USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS ship_cargo_ship_id_resource_key ON public.ship_cargo USING btree (ship_id, resource);

CREATE UNIQUE INDEX IF NOT EXISTS ship_types_pkey ON public.ship_types USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS ships_pkey ON public.ships USING btree (id);

CREATE INDEX IF NOT EXISTS idx_simulation_ticks_number ON public.simulation_ticks USING btree (tick_number DESC);

CREATE UNIQUE INDEX IF NOT EXISTS simulation_ticks_pkey ON public.simulation_ticks USING btree (id);

CREATE INDEX IF NOT EXISTS idx_tick_log_created ON public.tick_log USING btree (created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS tick_log_pkey ON public.tick_log USING btree (tick_number);

CREATE INDEX IF NOT EXISTS idx_tile_entities_actor ON public.tile_entities USING btree (actor_id, location_id);

CREATE INDEX IF NOT EXISTS idx_tile_entities_deposit ON public.tile_entities USING btree (deposit_id) WHERE (deposit_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_tile_entities_grid ON public.tile_entities USING btree (location_id, tile_level);

CREATE INDEX IF NOT EXISTS idx_tile_entities_land_value ON public.tile_entities USING btree (location_id, land_value DESC) WHERE (land_value > 0);

CREATE INDEX IF NOT EXISTS idx_tile_entities_owner ON public.tile_entities USING btree (profile_id, location_id);

CREATE INDEX IF NOT EXISTS idx_tile_entities_owner_class ON public.tile_entities USING btree (owner_class);

CREATE INDEX IF NOT EXISTS idx_tile_entities_owner_id ON public.tile_entities USING btree (owner_id) WHERE (owner_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_tile_entities_state_owned ON public.tile_entities USING btree (location_id, entity_id) WHERE (is_state_owned = true);

CREATE UNIQUE INDEX IF NOT EXISTS te_building_per_tile ON public.tile_entities USING btree (location_id, tile_level, tile_row, tile_col) WHERE ((entity_type = 'building'::text) AND (parent_id IS NULL));

CREATE UNIQUE INDEX IF NOT EXISTS te_one_per_slot ON public.tile_entities USING btree (parent_id, slot) WHERE (parent_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS te_parent_idx ON public.tile_entities USING btree (parent_id);

CREATE UNIQUE INDEX IF NOT EXISTS tile_entities_pkey ON public.tile_entities USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_building_per_tile ON public.tile_entities USING btree (location_id, tile_level, tile_row, tile_col) WHERE (entity_type = 'building'::text);

CREATE INDEX IF NOT EXISTS idx_trade_orders_location ON public.trade_orders USING btree (location_id);

CREATE INDEX IF NOT EXISTS idx_trade_orders_status ON public.trade_orders USING btree (status);

CREATE UNIQUE INDEX IF NOT EXISTS trade_orders_pkey ON public.trade_orders USING btree (id);

CREATE INDEX IF NOT EXISTS idx_trade_transactions_profile ON public.trade_transactions USING btree (profile_id);

CREATE INDEX IF NOT EXISTS idx_trade_transactions_time ON public.trade_transactions USING btree (traded_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS trade_transactions_pkey ON public.trade_transactions USING btree (id);

CREATE INDEX IF NOT EXISTS idx_world_events_active ON public.world_events USING btree (active);

CREATE UNIQUE INDEX IF NOT EXISTS world_events_pkey ON public.world_events USING btree (id);

-- ════════════════════════════════════
-- ROW LEVEL SECURITY
-- ════════════════════════════════════

ALTER TABLE academy_completions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "academy_completions_select_own" ON academy_completions;

CREATE POLICY "academy_completions_select_own"
  ON academy_completions FOR SELECT
  USING ((profile_id = auth.uid()));
DROP POLICY IF EXISTS "academy_completions_service_all" ON academy_completions;

CREATE POLICY "academy_completions_service_all"
  ON academy_completions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE academy_modules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "academy_modules_public_read" ON academy_modules;

CREATE POLICY "academy_modules_public_read"
  ON academy_modules FOR SELECT
  USING (true);
DROP POLICY IF EXISTS "academy_modules_service_all" ON academy_modules;

CREATE POLICY "academy_modules_service_all"
  ON academy_modules FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE actors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "actors_read" ON actors;

CREATE POLICY "actors_read"
  ON actors FOR SELECT
  USING (true);
DROP POLICY IF EXISTS "actors_select_all" ON actors;

CREATE POLICY "actors_select_all"
  ON actors FOR SELECT
  USING (true);
DROP POLICY IF EXISTS "actors_write_service" ON actors;

CREATE POLICY "actors_write_service"
  ON actors FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE building_definitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "building_definitions_select" ON building_definitions;

CREATE POLICY "building_definitions_select"
  ON building_definitions FOR SELECT
  USING (true);

ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Buildings öffentlich lesbar" ON buildings;

CREATE POLICY "Buildings öffentlich lesbar"
  ON buildings FOR SELECT
  USING (true);

ALTER TABLE colony_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "colony_ledger_select_all" ON colony_ledger;

CREATE POLICY "colony_ledger_select_all"
  ON colony_ledger FOR SELECT
  USING (true);
DROP POLICY IF EXISTS "colony_ledger_write_service" ON colony_ledger;

CREATE POLICY "colony_ledger_write_service"
  ON colony_ledger FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE colony_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "colony_settings_select_all" ON colony_settings;

CREATE POLICY "colony_settings_select_all"
  ON colony_settings FOR SELECT
  USING (true);
DROP POLICY IF EXISTS "colony_settings_write_service" ON colony_settings;

CREATE POLICY "colony_settings_write_service"
  ON colony_settings FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE colony_tariffs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "colony_tariffs_select_all" ON colony_tariffs;

CREATE POLICY "colony_tariffs_select_all"
  ON colony_tariffs FOR SELECT
  USING (true);
DROP POLICY IF EXISTS "colony_tariffs_write_service" ON colony_tariffs;

CREATE POLICY "colony_tariffs_write_service"
  ON colony_tariffs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE daily_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Eigene Tagesaufgaben lesen" ON daily_tasks;

CREATE POLICY "Eigene Tagesaufgaben lesen"
  ON daily_tasks FOR SELECT
  USING ((profile_id = auth.uid()));
DROP POLICY IF EXISTS "Service kann schreiben" ON daily_tasks;

CREATE POLICY "Service kann schreiben"
  ON daily_tasks FOR ALL
  USING (true)
  WITH CHECK (true);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "events_select" ON events;

CREATE POLICY "events_select"
  ON events FOR SELECT
  USING (true);

ALTER TABLE foundation_folien ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Folien lesen" ON foundation_folien;

CREATE POLICY "Folien lesen"
  ON foundation_folien FOR SELECT
  USING (true);
DROP POLICY IF EXISTS "Service schreibt Folien" ON foundation_folien;

CREATE POLICY "Service schreibt Folien"
  ON foundation_folien FOR ALL
  USING (true)
  WITH CHECK (true);

ALTER TABLE foundation_kurse ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Kurse lesen" ON foundation_kurse;

CREATE POLICY "Kurse lesen"
  ON foundation_kurse FOR SELECT
  USING ((published = true));

ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "friendships_select_own" ON friendships;

CREATE POLICY "friendships_select_own"
  ON friendships FOR SELECT
  USING (((profile_id = auth.uid()) OR (friend_id = auth.uid())));
DROP POLICY IF EXISTS "friendships_service_all" ON friendships;

CREATE POLICY "friendships_service_all"
  ON friendships FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE historical_milestones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Milestones öffentlich lesbar" ON historical_milestones;

CREATE POLICY "Milestones öffentlich lesbar"
  ON historical_milestones FOR SELECT
  USING (true);
DROP POLICY IF EXISTS "Service Role schreibt Milestones" ON historical_milestones;

CREATE POLICY "Service Role schreibt Milestones"
  ON historical_milestones FOR INSERT
  TO service_role
  WITH CHECK (true);

ALTER TABLE journey_steps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "journey_steps_select_all" ON journey_steps;

CREATE POLICY "journey_steps_select_all"
  ON journey_steps FOR SELECT
  USING (true);
DROP POLICY IF EXISTS "journey_steps_service_all" ON journey_steps;

CREATE POLICY "journey_steps_service_all"
  ON journey_steps FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE knowledge_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Eigene Transaktionen lesen" ON knowledge_transactions;

CREATE POLICY "Eigene Transaktionen lesen"
  ON knowledge_transactions FOR SELECT
  USING ((profile_id = auth.uid()));
DROP POLICY IF EXISTS "Service kann schreiben" ON knowledge_transactions;

CREATE POLICY "Service kann schreiben"
  ON knowledge_transactions FOR INSERT
  WITH CHECK (true);

ALTER TABLE kurs_fortschritt ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Eigener Fortschritt" ON kurs_fortschritt;

CREATE POLICY "Eigener Fortschritt"
  ON kurs_fortschritt FOR SELECT
  USING ((profile_id = auth.uid()));
DROP POLICY IF EXISTS "Service schreibt" ON kurs_fortschritt;

CREATE POLICY "Service schreibt"
  ON kurs_fortschritt FOR ALL
  USING (true)
  WITH CHECK (true);

ALTER TABLE kurs_voraussetzungen ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Voraussetzungen lesen" ON kurs_voraussetzungen;

CREATE POLICY "Voraussetzungen lesen"
  ON kurs_voraussetzungen FOR SELECT
  USING (true);

ALTER TABLE location_reputation ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reputation_select_own" ON location_reputation;

CREATE POLICY "reputation_select_own"
  ON location_reputation FOR SELECT
  USING ((profile_id = auth.uid()));
DROP POLICY IF EXISTS "reputation_service_all" ON location_reputation;

CREATE POLICY "reputation_service_all"
  ON location_reputation FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE location_resources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Location Resources öffentlich lesbar" ON location_resources;

CREATE POLICY "Location Resources öffentlich lesbar"
  ON location_resources FOR SELECT
  USING (true);
DROP POLICY IF EXISTS "Service Role schreibt Location Resources" ON location_resources;

CREATE POLICY "Service Role schreibt Location Resources"
  ON location_resources FOR INSERT
  TO service_role
  WITH CHECK (true);
DROP POLICY IF EXISTS "Service Role updated Location Resources" ON location_resources;

CREATE POLICY "Service Role updated Location Resources"
  ON location_resources FOR UPDATE
  TO service_role
  USING (true);

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Locations öffentlich lesbar" ON locations;

CREATE POLICY "Locations öffentlich lesbar"
  ON locations FOR SELECT
  USING (true);
DROP POLICY IF EXISTS "Service Role schreibt Locations" ON locations;

CREATE POLICY "Service Role schreibt Locations"
  ON locations FOR INSERT
  TO service_role
  WITH CHECK (true);
DROP POLICY IF EXISTS "Service Role updated Locations" ON locations;

CREATE POLICY "Service Role updated Locations"
  ON locations FOR UPDATE
  TO service_role
  USING (true);

ALTER TABLE market_prices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Marktpreise öffentlich lesbar" ON market_prices;

CREATE POLICY "Marktpreise öffentlich lesbar"
  ON market_prices FOR SELECT
  USING (true);
DROP POLICY IF EXISTS "Service Role schreibt Preise" ON market_prices;

CREATE POLICY "Service Role schreibt Preise"
  ON market_prices FOR INSERT
  TO service_role
  WITH CHECK (true);
DROP POLICY IF EXISTS "Service Role updated Preise" ON market_prices;

CREATE POLICY "Service Role updated Preise"
  ON market_prices FOR UPDATE
  TO service_role
  USING (true);

ALTER TABLE npc_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "npc_ledger_read" ON npc_ledger;

CREATE POLICY "npc_ledger_read"
  ON npc_ledger FOR SELECT
  USING (true);

ALTER TABLE npc_trades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "npc_trades_read" ON npc_trades;

CREATE POLICY "npc_trades_read"
  ON npc_trades FOR SELECT
  USING (true);

ALTER TABLE player_buildings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Player Buildings öffentlich lesbar" ON player_buildings;

CREATE POLICY "Player Buildings öffentlich lesbar"
  ON player_buildings FOR SELECT
  USING (true);
DROP POLICY IF EXISTS "Spieler baut eigene Gebäude" ON player_buildings;

CREATE POLICY "Spieler baut eigene Gebäude"
  ON player_buildings FOR INSERT
  WITH CHECK ((auth.uid() = profile_id));

ALTER TABLE player_builds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Spieler sieht eigene Builds" ON player_builds;

CREATE POLICY "Spieler sieht eigene Builds"
  ON player_builds FOR ALL
  USING ((auth.uid() = profile_id));

ALTER TABLE player_journeys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "journeys_insert_own" ON player_journeys;

CREATE POLICY "journeys_insert_own"
  ON player_journeys FOR INSERT
  WITH CHECK ((profile_id = auth.uid()));
DROP POLICY IF EXISTS "journeys_select_own" ON player_journeys;

CREATE POLICY "journeys_select_own"
  ON player_journeys FOR SELECT
  USING ((profile_id = auth.uid()));
DROP POLICY IF EXISTS "journeys_service_all" ON player_journeys;

CREATE POLICY "journeys_service_all"
  ON player_journeys FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
DROP POLICY IF EXISTS "journeys_update_own" ON player_journeys;

CREATE POLICY "journeys_update_own"
  ON player_journeys FOR UPDATE
  USING ((profile_id = auth.uid()));

ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "price_history_select" ON price_history;

CREATE POLICY "price_history_select"
  ON price_history FOR SELECT
  USING (true);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Profil öffentlich lesbar" ON profiles;

CREATE POLICY "Profil öffentlich lesbar"
  ON profiles FOR SELECT
  USING (true);
DROP POLICY IF EXISTS "Spieler aktualisiert eigenes Profil" ON profiles;

CREATE POLICY "Spieler aktualisiert eigenes Profil"
  ON profiles FOR UPDATE
  USING ((auth.uid() = id));
DROP POLICY IF EXISTS "Spieler liest eigenes Profil" ON profiles;

CREATE POLICY "Spieler liest eigenes Profil"
  ON profiles FOR SELECT
  USING ((auth.uid() = id));
DROP POLICY IF EXISTS "profiles_service_all" ON profiles;

CREATE POLICY "profiles_service_all"
  ON profiles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
DROP POLICY IF EXISTS "profiles_service_read" ON profiles;

CREATE POLICY "profiles_service_read"
  ON profiles FOR SELECT
  TO service_role
  USING (true);

ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Resources öffentlich lesbar" ON resources;

CREATE POLICY "Resources öffentlich lesbar"
  ON resources FOR SELECT
  USING (true);

ALTER TABLE ship_cargo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Cargo öffentlich lesbar" ON ship_cargo;

CREATE POLICY "Cargo öffentlich lesbar"
  ON ship_cargo FOR SELECT
  USING (true);
DROP POLICY IF EXISTS "Spieler liest eigene Cargo" ON ship_cargo;

CREATE POLICY "Spieler liest eigene Cargo"
  ON ship_cargo FOR SELECT
  USING ((EXISTS ( SELECT 1
   FROM ships
  WHERE ((ships.id = ship_cargo.ship_id) AND (ships.profile_id = auth.uid())))));
DROP POLICY IF EXISTS "Spieler verwaltet eigene Ladung" ON ship_cargo;

CREATE POLICY "Spieler verwaltet eigene Ladung"
  ON ship_cargo FOR ALL
  USING ((EXISTS ( SELECT 1
   FROM ships
  WHERE ((ships.id = ship_cargo.ship_id) AND (ships.profile_id = auth.uid())))));

ALTER TABLE ship_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Ship types öffentlich lesbar" ON ship_types;

CREATE POLICY "Ship types öffentlich lesbar"
  ON ship_types FOR SELECT
  USING (true);

ALTER TABLE ships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Schiffe öffentlich lesbar" ON ships;

CREATE POLICY "Schiffe öffentlich lesbar"
  ON ships FOR SELECT
  USING (true);
DROP POLICY IF EXISTS "Spieler liest eigenes Schiff" ON ships;

CREATE POLICY "Spieler liest eigenes Schiff"
  ON ships FOR SELECT
  USING ((auth.uid() = profile_id));
DROP POLICY IF EXISTS "Spieler steuert eigenes Schiff" ON ships;

CREATE POLICY "Spieler steuert eigenes Schiff"
  ON ships FOR UPDATE
  USING ((auth.uid() = profile_id));
DROP POLICY IF EXISTS "ships_service_all" ON ships;

CREATE POLICY "ships_service_all"
  ON ships FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE simulation_ticks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service Role schreibt Ticks" ON simulation_ticks;

CREATE POLICY "Service Role schreibt Ticks"
  ON simulation_ticks FOR INSERT
  TO service_role
  WITH CHECK (true);
DROP POLICY IF EXISTS "Service Role updated Ticks" ON simulation_ticks;

CREATE POLICY "Service Role updated Ticks"
  ON simulation_ticks FOR UPDATE
  TO service_role
  USING (true);
DROP POLICY IF EXISTS "Ticks öffentlich lesbar" ON simulation_ticks;

CREATE POLICY "Ticks öffentlich lesbar"
  ON simulation_ticks FOR SELECT
  USING (true);

ALTER TABLE tick_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tick_log_select" ON tick_log;

CREATE POLICY "tick_log_select"
  ON tick_log FOR SELECT
  USING (true);

ALTER TABLE tile_entities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tile_entities_select" ON tile_entities;

CREATE POLICY "tile_entities_select"
  ON tile_entities FOR SELECT
  USING (true);

ALTER TABLE trade_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Aufträge öffentlich lesbar" ON trade_orders;

CREATE POLICY "Aufträge öffentlich lesbar"
  ON trade_orders FOR SELECT
  USING (true);
DROP POLICY IF EXISTS "Service Role erstellt Aufträge" ON trade_orders;

CREATE POLICY "Service Role erstellt Aufträge"
  ON trade_orders FOR INSERT
  TO service_role
  WITH CHECK (true);
DROP POLICY IF EXISTS "Spieler erfüllt offene Aufträge" ON trade_orders;

CREATE POLICY "Spieler erfüllt offene Aufträge"
  ON trade_orders FOR UPDATE
  USING ((status = 'open'::order_status));

ALTER TABLE trade_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Spieler erstellt eigene Transaktionen" ON trade_transactions;

CREATE POLICY "Spieler erstellt eigene Transaktionen"
  ON trade_transactions FOR INSERT
  WITH CHECK ((auth.uid() = profile_id));
DROP POLICY IF EXISTS "Transaktionen öffentlich lesbar" ON trade_transactions;

CREATE POLICY "Transaktionen öffentlich lesbar"
  ON trade_transactions FOR SELECT
  USING (true);

ALTER TABLE world_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Events öffentlich lesbar" ON world_events;

CREATE POLICY "Events öffentlich lesbar"
  ON world_events FOR SELECT
  USING (true);
DROP POLICY IF EXISTS "Service Role schreibt Events" ON world_events;

CREATE POLICY "Service Role schreibt Events"
  ON world_events FOR INSERT
  TO service_role
  WITH CHECK (true);
DROP POLICY IF EXISTS "Service Role updated Events" ON world_events;

CREATE POLICY "Service Role updated Events"
  ON world_events FOR UPDATE
  TO service_role
  USING (true);

-- ════════════════════════════════════
-- GRANTS
-- ════════════════════════════════════
GRANT ALL ON academy_completions TO service_role;
GRANT ALL ON academy_completions TO authenticated;
GRANT ALL ON academy_modules TO service_role;
GRANT ALL ON academy_modules TO authenticated;
GRANT ALL ON actors TO service_role;
GRANT ALL ON actors TO authenticated;
GRANT ALL ON bank_accounts TO service_role;
GRANT ALL ON bank_accounts TO authenticated;
GRANT ALL ON bank_ledger TO service_role;
GRANT ALL ON bank_ledger TO authenticated;
GRANT ALL ON building_definitions TO service_role;
GRANT ALL ON building_definitions TO authenticated;
GRANT ALL ON buildings TO service_role;
GRANT ALL ON buildings TO authenticated;
GRANT ALL ON colony_ledger TO service_role;
GRANT ALL ON colony_ledger TO authenticated;
GRANT ALL ON colony_settings TO service_role;
GRANT ALL ON colony_settings TO authenticated;
GRANT ALL ON colony_tariffs TO service_role;
GRANT ALL ON colony_tariffs TO authenticated;
GRANT ALL ON daily_tasks TO service_role;
GRANT ALL ON daily_tasks TO authenticated;
GRANT ALL ON events TO service_role;
GRANT ALL ON events TO authenticated;
GRANT ALL ON foundation_folien TO service_role;
GRANT ALL ON foundation_folien TO authenticated;
GRANT ALL ON foundation_kurse TO service_role;
GRANT ALL ON foundation_kurse TO authenticated;
GRANT ALL ON friendships TO service_role;
GRANT ALL ON friendships TO authenticated;
GRANT ALL ON historical_milestones TO service_role;
GRANT ALL ON historical_milestones TO authenticated;
GRANT ALL ON location_reputation TO service_role;
GRANT ALL ON location_reputation TO authenticated;
GRANT ALL ON location_resources TO service_role;
GRANT ALL ON location_resources TO authenticated;
GRANT ALL ON locations TO service_role;
GRANT ALL ON locations TO authenticated;
GRANT ALL ON market_prices TO service_role;
GRANT ALL ON market_prices TO authenticated;
GRANT ALL ON npc_ledger TO service_role;
GRANT ALL ON npc_ledger TO authenticated;
GRANT ALL ON player_buildings TO service_role;
GRANT ALL ON player_buildings TO authenticated;
GRANT ALL ON player_builds TO service_role;
GRANT ALL ON player_builds TO authenticated;
GRANT ALL ON player_learning_progress TO service_role;
GRANT ALL ON player_learning_progress TO authenticated;
GRANT ALL ON price_history TO service_role;
GRANT ALL ON price_history TO authenticated;
GRANT ALL ON profiles TO service_role;
GRANT ALL ON profiles TO authenticated;
GRANT ALL ON resources TO service_role;
GRANT ALL ON resources TO authenticated;
GRANT ALL ON ship_cargo TO service_role;
GRANT ALL ON ship_cargo TO authenticated;
GRANT ALL ON ships TO service_role;
GRANT ALL ON ships TO authenticated;
GRANT ALL ON simulation_ticks TO service_role;
GRANT ALL ON simulation_ticks TO authenticated;
GRANT ALL ON tick_log TO service_role;
GRANT ALL ON tick_log TO authenticated;
GRANT ALL ON tile_entities TO service_role;
GRANT ALL ON tile_entities TO authenticated;
GRANT ALL ON trade_orders TO service_role;
GRANT ALL ON trade_orders TO authenticated;
GRANT ALL ON trade_transactions TO service_role;
GRANT ALL ON trade_transactions TO authenticated;
GRANT ALL ON world_events TO service_role;
GRANT ALL ON world_events TO authenticated;

-- Ende Baseline

-- ════════════════════════════════════
-- POST-BASELINE ADDITIONS (2026-07-20)
-- ════════════════════════════════════

-- ssf_completions (NOX-SSF-0008)
CREATE TABLE IF NOT EXISTS ssf_completions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  noxia_uid    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  path_id      text        NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  source       text        NOT NULL DEFAULT 'ssf',
  UNIQUE(noxia_uid, path_id)
);
ALTER TABLE ssf_completions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ssf_completions_select_own" ON ssf_completions;
CREATE POLICY "ssf_completions_select_own" ON ssf_completions FOR SELECT USING (noxia_uid = auth.uid());
DROP POLICY IF EXISTS "ssf_completions_service_all" ON ssf_completions;
CREATE POLICY "ssf_completions_service_all" ON ssf_completions FOR ALL TO service_role USING (true) WITH CHECK (true);
GRANT ALL ON ssf_completions TO service_role;
GRANT ALL ON ssf_completions TO authenticated;

-- asking_price auf tile_entities (NOX-0009)
ALTER TABLE tile_entities ADD COLUMN IF NOT EXISTS asking_price integer;

-- building_trades (NOX-0009)
CREATE TABLE IF NOT EXISTS building_trades (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id   uuid        NOT NULL,
  entity_key  text        NOT NULL,
  location_id uuid        NOT NULL REFERENCES locations(id),
  tile_row    smallint    NOT NULL,
  tile_col    smallint    NOT NULL,
  seller_id   uuid        NOT NULL REFERENCES profiles(id),
  buyer_id    uuid        NOT NULL REFERENCES profiles(id),
  price       integer     NOT NULL,
  traded_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE building_trades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "trades_select_own" ON building_trades;
CREATE POLICY "trades_select_own" ON building_trades FOR SELECT USING (seller_id = auth.uid() OR buyer_id = auth.uid());
DROP POLICY IF EXISTS "trades_service_all" ON building_trades;
CREATE POLICY "trades_service_all" ON building_trades FOR ALL TO service_role USING (true) WITH CHECK (true);
GRANT ALL ON building_trades TO service_role;
GRANT ALL ON building_trades TO authenticated;

-- player_unlocks (Schritt 2)
CREATE TABLE IF NOT EXISTS player_unlocks (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  unlock_id     text        NOT NULL,
  granted_at    timestamptz NOT NULL DEFAULT now(),
  source_module text
);
CREATE UNIQUE INDEX IF NOT EXISTS player_unlocks_profile_unlock ON player_unlocks (profile_id, unlock_id);
ALTER TABLE player_unlocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "unlocks_select_own" ON player_unlocks;
CREATE POLICY "unlocks_select_own" ON player_unlocks FOR SELECT USING (profile_id = auth.uid());
DROP POLICY IF EXISTS "unlocks_service_all" ON player_unlocks;
CREATE POLICY "unlocks_service_all" ON player_unlocks FOR ALL TO service_role USING (true) WITH CHECK (true);
GRANT ALL ON player_unlocks TO service_role;
GRANT ALL ON player_unlocks TO authenticated;
