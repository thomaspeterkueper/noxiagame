-- components / Bauteile: erste Industriekette
-- Mine -> Metall -> Fabrik -> Bauteile

-- 1) Ressource pro Standort anlegen, falls sie fehlt.
insert into location_resources (location_id, resource, stock, production, consumption)
select id, 'components', 0, 0, 0
from locations
where not exists (
  select 1
  from location_resources lr
  where lr.location_id = locations.id
    and lr.resource = 'components'
);

-- 2) Marktpreis pro Standort anlegen, falls er fehlt.
insert into market_prices (location_id, resource, buy_price, sell_price, avg_sell_7)
select id, 'components', 220, 180, 180
from locations
where not exists (
  select 1
  from market_prices mp
  where mp.location_id = locations.id
    and mp.resource = 'components'
);

-- 3) Fabrik-Definition produktiv machen.
update building_definitions
set
  production = '[{"resource":"components","amount":1}]'::jsonb,
  consumption = '[{"resource":"metal","amount":3}]'::jsonb,
  is_active = true
where key = 'factory';

-- 4) Falls factory in der DB noch fehlt, anlegen.
insert into building_definitions (
  key, name, cost_credits, population_bonus, production, consumption,
  allowed_locations, build_time_ticks, is_active
)
select
  'factory', 'Fabrik', 4500, 0,
  '[{"resource":"components","amount":1}]'::jsonb,
  '[{"resource":"metal","amount":3}]'::jsonb,
  array['earth','mars'], 4, true
where not exists (
  select 1 from building_definitions where key = 'factory'
);
