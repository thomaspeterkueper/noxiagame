-- NOXIA-FOOD-0001, Stufe 1b: Lebensmittel existieren, lagern, werden gehandelt und produziert.
-- Noch kein Verbrauch: Bewohner, Lokale und Kantine ziehen erst ab Stufe 2/3 aus dem Bestand.
-- Einheit wie alle Güter: Tonnen. Idempotent.

set search_path to public;

insert into resources (type, label, unit)
values ('food', 'Lebensmittel', 't')
on conflict do nothing;

-- Startbestand: Erde reichlich (Landwirtschaft), sonst rund 30 Spieltage künftigen Bedarfs
-- (vorläufig 0,5 t je 100 Bewohner und Tick), mindestens 200 t.
insert into location_resources (location_id, resource, stock, production, consumption)
select l.id, 'food'::resource_type,
       case when l.slug = 'earth' then 100000
            else greatest(200, ceil(l.population / 100.0 * 0.5)::integer * 24 * 30) end,
       0, 0
from locations l
where exists (select 1 from location_resources r where r.location_id = l.id)  -- nur Orte mit Warenwirtschaft
on conflict (location_id, resource) do nothing;

-- Marktpreis je Tonne: auf der Erde billig, sonst wie ein knappes Grundgut.
insert into market_prices (location_id, resource, buy_price, sell_price, avg_sell_7)
select l.id, 'food'::resource_type,
       case when l.slug = 'earth' then 40 else 80 end,
       case when l.slug = 'earth' then 30 else 60 end,
       case when l.slug = 'earth' then 30 else 60 end
from locations l
where exists (select 1 from market_prices m where m.location_id = l.id)
on conflict (location_id, resource) do nothing;

-- Erste Lebensmittelquelle außerhalb der Erde.
insert into building_definitions (
  key, name, cost_credits, population_bonus, production, consumption,
  allowed_locations, build_time_ticks, is_active
)
values (
  'hydroponics', 'Hydroponik', 2400, 0,
  '[{"resource":"food","amount":2}]'::jsonb,
  '[{"resource":"water","amount":1},{"resource":"energy","amount":1}]'::jsonb,
  array['moon','mars','phobos','deimos','prometheus','q1'], 3, true
)
on conflict (key) do update set
  production = excluded.production, consumption = excluded.consumption, is_active = true;
