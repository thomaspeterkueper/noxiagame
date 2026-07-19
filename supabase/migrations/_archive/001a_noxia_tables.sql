-- ============================================================
-- NOXIA – Block 1: Typen, Tabellen, Daten
-- ============================================================

create extension if not exists "uuid-ossp";

-- ENUMS
create type resource_type as enum ('water', 'energy', 'metal');
create type building_type as enum ('mine', 'solar', 'habitat');
create type ship_type     as enum ('freighter');
create type ship_status   as enum ('docked', 'transit');
create type order_status  as enum ('open', 'fulfilled', 'expired');
create type event_type    as enum ('mine_collapse', 'habitat_built', 'power_outage');

-- PROFILES
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text not null unique
                 constraint username_length check (char_length(username) between 3 and 24),
  credits      integer not null default 5000
                 constraint credits_positive check (credits >= 0),
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- LOCATIONS
create table public.locations (
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

insert into public.locations (slug, name, description, population, population_max) values
  ('moon',   'Mond / Shackleton',  'Industriestation. Bergbau rund um die Uhr.',     800,  5000),
  ('mars',   'Mars / Tharsis Hub', 'Größte außerirdische Siedlung. Wächst schnell.', 1200, 20000),
  ('phobos', 'Phobos',             'Freihafen. Kein Recht, keine Fragen, billig.',    350,  3000);

-- RESOURCES
create table public.resources (
  type  resource_type primary key,
  label text not null,
  unit  text not null default 't'
);

insert into public.resources (type, label) values
  ('water'::resource_type,  'Wasser'),
  ('energy'::resource_type, 'Energie'),
  ('metal'::resource_type,  'Metall');

-- LOCATION RESOURCES
create table public.location_resources (
  id          uuid primary key default uuid_generate_v4(),
  location_id uuid not null references public.locations(id) on delete cascade,
  resource    resource_type not null,
  stock       integer not null default 0 constraint stock_non_negative check (stock >= 0),
  consumption integer not null default 0,
  production  integer not null default 0,
  updated_at  timestamptz not null default now(),
  unique (location_id, resource)
);

insert into public.location_resources (location_id, resource, stock, consumption, production)
select id, 'water'::resource_type,  200,  8,  0 from public.locations where slug = 'moon' union all
select id, 'energy'::resource_type, 300,  4,  6 from public.locations where slug = 'moon' union all
select id, 'metal'::resource_type,  500,  2, 10 from public.locations where slug = 'moon';

insert into public.location_resources (location_id, resource, stock, consumption, production)
select id, 'water'::resource_type,  150, 12,  0 from public.locations where slug = 'mars' union all
select id, 'energy'::resource_type, 400,  6,  8 from public.locations where slug = 'mars' union all
select id, 'metal'::resource_type,  300,  3,  5 from public.locations where slug = 'mars';

insert into public.location_resources (location_id, resource, stock, consumption, production)
select id, 'water'::resource_type,   80,  3,  0 from public.locations where slug = 'phobos' union all
select id, 'energy'::resource_type, 150,  2,  3 from public.locations where slug = 'phobos' union all
select id, 'metal'::resource_type,  200,  1,  2 from public.locations where slug = 'phobos';

-- BUILDINGS
create table public.buildings (
  type             building_type primary key,
  label            text not null,
  description      text,
  cost_credits     integer not null,
  effect_resource  resource_type,
  effect_amount    integer,
  population_bonus integer
);

insert into public.buildings (type, label, description, cost_credits, effect_resource, effect_amount, population_bonus) values
  ('mine'::building_type,    'Mine',      'Produziert Metall.',                500, 'metal'::resource_type,  5,    null),
  ('solar'::building_type,   'Solarfeld', 'Produziert Energie.',               400, 'energy'::resource_type, 4,    null),
  ('habitat'::building_type, 'Habitat',   'Erhöht maximale Bevölkerung +100.', 800,  null,                   null, 100);

-- PLAYER BUILDINGS
create table public.player_buildings (
  id          uuid primary key default uuid_generate_v4(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  building    building_type not null,
  built_at    timestamptz not null default now()
);

-- SHIPS
create table public.ships (
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

-- SHIP CARGO
create table public.ship_cargo (
  id       uuid primary key default uuid_generate_v4(),
  ship_id  uuid not null references public.ships(id) on delete cascade,
  resource resource_type not null,
  amount   integer not null constraint amount_positive check (amount > 0),
  unique (ship_id, resource)
);

-- MARKET PRICES
create table public.market_prices (
  id          uuid primary key default uuid_generate_v4(),
  location_id uuid not null references public.locations(id) on delete cascade,
  resource    resource_type not null,
  buy_price   integer not null constraint buy_positive check (buy_price > 0),
  sell_price  integer not null constraint sell_positive check (sell_price > 0),
  constraint  sell_below_buy check (sell_price < buy_price),
  updated_at  timestamptz not null default now(),
  unique (location_id, resource)
);

insert into public.market_prices (location_id, resource, buy_price, sell_price)
select id, 'water'::resource_type,  120, 90 from public.locations where slug = 'moon' union all
select id, 'energy'::resource_type,  60, 45 from public.locations where slug = 'moon' union all
select id, 'metal'::resource_type,   40, 30 from public.locations where slug = 'moon';

insert into public.market_prices (location_id, resource, buy_price, sell_price)
select id, 'water'::resource_type,  180, 140 from public.locations where slug = 'mars' union all
select id, 'energy'::resource_type,  80,  60 from public.locations where slug = 'mars' union all
select id, 'metal'::resource_type,   70,  55 from public.locations where slug = 'mars';

insert into public.market_prices (location_id, resource, buy_price, sell_price)
select id, 'water'::resource_type,  100,  75 from public.locations where slug = 'phobos' union all
select id, 'energy'::resource_type,  70,  50 from public.locations where slug = 'phobos' union all
select id, 'metal'::resource_type,   55,  40 from public.locations where slug = 'phobos';

-- TRADE ORDERS
create table public.trade_orders (
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

-- TRADE TRANSACTIONS
create table public.trade_transactions (
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

-- WORLD EVENTS
create table public.world_events (
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

-- HISTORICAL MILESTONES
create table public.historical_milestones (
  id          uuid primary key default uuid_generate_v4(),
  type        text not null,
  description text not null,
  profile_id  uuid references public.profiles(id),
  data        jsonb not null default '{}',
  achieved_at timestamptz not null default now()
);

-- SIMULATION TICKS
create table public.simulation_ticks (
  id          uuid primary key default uuid_generate_v4(),
  tick_number bigint not null,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms integer,
  summary     jsonb not null default '{}'
);

-- INDIZES
create index idx_location_resources_location on public.location_resources(location_id);
create index idx_player_buildings_profile    on public.player_buildings(profile_id);
create index idx_player_buildings_location   on public.player_buildings(location_id);
create index idx_ship_cargo_ship             on public.ship_cargo(ship_id);
create index idx_market_prices_location      on public.market_prices(location_id);
create index idx_trade_orders_location       on public.trade_orders(location_id);
create index idx_trade_orders_status         on public.trade_orders(status);
create index idx_trade_transactions_profile  on public.trade_transactions(profile_id);
create index idx_trade_transactions_time     on public.trade_transactions(traded_at desc);
create index idx_world_events_active         on public.world_events(active);
create index idx_simulation_ticks_number     on public.simulation_ticks(tick_number desc);
