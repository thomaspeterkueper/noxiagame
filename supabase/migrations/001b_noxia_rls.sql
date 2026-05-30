-- ============================================================
-- NOXIA – Block 2: RLS, Policies, Trigger, Realtime
-- ============================================================

-- RLS aktivieren
alter table public.profiles           enable row level security;
alter table public.locations          enable row level security;
alter table public.resources          enable row level security;
alter table public.location_resources enable row level security;
alter table public.buildings          enable row level security;
alter table public.player_buildings   enable row level security;
alter table public.ships              enable row level security;
alter table public.ship_cargo         enable row level security;
alter table public.market_prices      enable row level security;
alter table public.trade_orders       enable row level security;
alter table public.trade_transactions enable row level security;
alter table public.world_events       enable row level security;
alter table public.historical_milestones enable row level security;
alter table public.simulation_ticks   enable row level security;

-- PROFILES
create policy "Profil öffentlich lesbar"
  on public.profiles for select using (true);
create policy "Spieler aktualisiert eigenes Profil"
  on public.profiles for update using (auth.uid() = id);

-- LOCATIONS
create policy "Locations öffentlich lesbar"
  on public.locations for select using (true);
create policy "Service Role schreibt Locations"
  on public.locations for insert with check (auth.role() = 'service_role');
create policy "Service Role updated Locations"
  on public.locations for update using (auth.role() = 'service_role');

-- RESOURCES
create policy "Resources öffentlich lesbar"
  on public.resources for select using (true);

-- LOCATION RESOURCES
create policy "Location Resources öffentlich lesbar"
  on public.location_resources for select using (true);
create policy "Service Role schreibt Location Resources"
  on public.location_resources for insert with check (auth.role() = 'service_role');
create policy "Service Role updated Location Resources"
  on public.location_resources for update using (auth.role() = 'service_role');

-- BUILDINGS
create policy "Buildings öffentlich lesbar"
  on public.buildings for select using (true);

-- PLAYER BUILDINGS
create policy "Player Buildings öffentlich lesbar"
  on public.player_buildings for select using (true);
create policy "Spieler baut eigene Gebäude"
  on public.player_buildings for insert with check (auth.uid() = profile_id);

-- SHIPS
create policy "Schiffe öffentlich lesbar"
  on public.ships for select using (true);
create policy "Spieler steuert eigenes Schiff"
  on public.ships for update using (auth.uid() = profile_id);

-- SHIP CARGO
create policy "Cargo öffentlich lesbar"
  on public.ship_cargo for select using (true);
create policy "Spieler verwaltet eigene Ladung"
  on public.ship_cargo for all
  using (
    exists (
      select 1 from public.ships
      where ships.id = ship_cargo.ship_id
        and ships.profile_id = auth.uid()
    )
  );

-- MARKET PRICES
create policy "Marktpreise öffentlich lesbar"
  on public.market_prices for select using (true);
create policy "Service Role schreibt Preise"
  on public.market_prices for insert with check (auth.role() = 'service_role');
create policy "Service Role updated Preise"
  on public.market_prices for update using (auth.role() = 'service_role');

-- TRADE ORDERS
create policy "Aufträge öffentlich lesbar"
  on public.trade_orders for select using (true);
create policy "Service Role erstellt Aufträge"
  on public.trade_orders for insert with check (auth.role() = 'service_role');
create policy "Spieler erfüllt offene Aufträge"
  on public.trade_orders for update using (status = 'open');

-- TRADE TRANSACTIONS
create policy "Transaktionen öffentlich lesbar"
  on public.trade_transactions for select using (true);
create policy "Spieler erstellt eigene Transaktionen"
  on public.trade_transactions for insert with check (auth.uid() = profile_id);

-- WORLD EVENTS
create policy "Events öffentlich lesbar"
  on public.world_events for select using (true);
create policy "Service Role schreibt Events"
  on public.world_events for insert with check (auth.role() = 'service_role');
create policy "Service Role updated Events"
  on public.world_events for update using (auth.role() = 'service_role');

-- HISTORICAL MILESTONES
create policy "Milestones öffentlich lesbar"
  on public.historical_milestones for select using (true);
create policy "Service Role schreibt Milestones"
  on public.historical_milestones for insert with check (auth.role() = 'service_role');

-- SIMULATION TICKS
create policy "Ticks öffentlich lesbar"
  on public.simulation_ticks for select using (true);
create policy "Service Role schreibt Ticks"
  on public.simulation_ticks for insert with check (auth.role() = 'service_role');
create policy "Service Role updated Ticks"
  on public.simulation_ticks for update using (auth.role() = 'service_role');

-- TRIGGER: updated_at
create or replace function public.update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_locations_updated_at
  before update on public.locations
  for each row execute procedure public.update_updated_at();

create trigger trg_location_resources_updated_at
  before update on public.location_resources
  for each row execute procedure public.update_updated_at();

create trigger trg_market_prices_updated_at
  before update on public.market_prices
  for each row execute procedure public.update_updated_at();

-- TRIGGER: auto Profil bei neuem Auth-User
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- TRIGGER: auto Schiff bei neuem Profil
create or replace function public.handle_new_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.ships (profile_id, location)
  values (new.id, 'moon');
  return new;
end;
$$;

create trigger on_profile_created
  after insert on public.profiles
  for each row execute procedure public.handle_new_profile();

-- REALTIME
alter publication supabase_realtime add table public.locations;
alter publication supabase_realtime add table public.location_resources;
alter publication supabase_realtime add table public.market_prices;
alter publication supabase_realtime add table public.trade_orders;
alter publication supabase_realtime add table public.world_events;
alter publication supabase_realtime add table public.historical_milestones;
