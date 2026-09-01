-- NOXIA components chain consolidation
-- 2026-08-31
--
-- Reproduces the data effects of the archived 20260628_components_chain.sql
-- (history bridged by 20260628_remote_history_bridge.sql) for fresh replays:
-- per-location 'components' stock and market rows plus the factory definition.
-- Production already carries these rows, so every statement is idempotent.
--
-- Runs after 20260831204500_add_components_resource_type.sql so the
-- resource_type enum already contains 'components' for the typed INSERTs.

set search_path to public;

-- 1) Ressource pro Standort anlegen, falls sie fehlt.
--    Ohne diese Zeilen schlägt noxia_consume_build_resources mit
--    NOXIA_BUILD_RESOURCE_MISSING fehl und 'components' ist unhandelbar.
insert into location_resources (location_id, resource, stock, production, consumption)
select id, 'components'::resource_type, 0, 0, 0
from locations
on conflict (location_id, resource) do nothing;

-- 2) Marktpreis pro Standort anlegen, falls er fehlt.
--    avg_sell_7 stammt aus der archivierten 005_price_avg.sql und ist kein
--    Teil des konsolidierten Schemas; bewusst weggelassen.
insert into market_prices (location_id, resource, buy_price, sell_price)
select id, 'components'::resource_type, 220, 180
from locations
on conflict (location_id, resource) do nothing;

-- 3) Fabrik-Definition produktiv machen, falls sie noch fehlt.
insert into building_definitions (
  key, name, cost_credits, population_bonus, production, consumption,
  allowed_locations, build_time_ticks, is_active
)
values (
  'factory', 'Fabrik', 4500, 0,
  '[{"resource":"components","amount":1}]'::jsonb,
  '[{"resource":"metal","amount":3}]'::jsonb,
  array['earth','mars'], 4, true
)
on conflict (key) do nothing;

update building_definitions
set
  production  = '[{"resource":"components","amount":1}]'::jsonb,
  consumption = '[{"resource":"metal","amount":3}]'::jsonb,
  is_active   = true
where key = 'factory';
