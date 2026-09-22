-- Shackleton Base Alpha: erster persistenter Mond-Startbestand.
-- NOXIA ist Source of Truth fuer Gameplay-Objekte, Positionen und Balancing.
-- Technische Leistungsgrenzen werden hier bewusst nicht erfunden.

SET search_path TO public;

-- Mondtaugliche Gameplay-Definitionen. Vorhandene generische Objekte werden
-- erweitert, fehlende rein spielmechanische Oberflaechenobjekte registriert.
UPDATE building_definitions
SET allowed_locations = ARRAY['earth','moon']
WHERE key = 'warehouse';

INSERT INTO building_definitions
  (key,name,description,category,tier,cost_credits,build_time_ticks,production,consumption,population_bonus,allowed_locations,is_active)
VALUES
  ('life_support_hub','Lebenserhaltung','Lokaler ECLSS-Knoten fuer Atmosphaere, Wasser- und Abfallkreislauf.','infrastructure',1,5000,4,'[]'::jsonb,'[]'::jsonb,0,ARRAY['moon'],true),
  ('battery_storage','Batteriespeicher','Lokaler Energiespeicher fuer die Oberflaechenbasis.','infrastructure',1,3200,3,'[]'::jsonb,'[]'::jsonb,0,ARRAY['moon'],true),
  ('surface_workshop','Werkstatt','Wartung, Reparatur und vorbereitende Fertigung fuer die Mondoberflaeche.','production',1,4200,4,'[]'::jsonb,'[]'::jsonb,0,ARRAY['moon'],true),
  ('rover_yard','Roverhof','Abstell-, Lade-, Wartungs- und Umschlagbereich fuer Surface-Fahrzeuge.','infrastructure',1,2800,3,'[]'::jsonb,'[]'::jsonb,0,ARRAY['moon'],true),
  ('surface_comms','Kommunikationsmast','Lokaler Kommunikations- und Datenknoten der Mondbasis.','infrastructure',1,2400,2,'[]'::jsonb,'[]'::jsonb,0,ARRAY['moon'],true),
  ('landing_pad_moon','Lande- und Cargo-Zone','Mond-Landeplatz mit Frachtumschlag und Anbindung an das Warenhaus.','infrastructure',1,5000,4,'[]'::jsonb,'[]'::jsonb,0,ARRAY['moon'],true)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  tier = EXCLUDED.tier,
  cost_credits = EXCLUDED.cost_credits,
  build_time_ticks = EXCLUDED.build_time_ticks,
  allowed_locations = EXCLUDED.allowed_locations,
  is_active = true;

-- Staatlicher Anfangsbestand. Der Seed ist idempotent und beruehrt keine
-- Spielerbauten. Koordinaten sind lokale ENU-Meter im verifizierten
-- Shackleton-Frame; +x Ost, +y Nord.
WITH moon_location AS (
  SELECT id FROM locations WHERE slug = 'moon'
), seed(entity_id,x_m,y_m,rotation_deg,footprint_width_m,footprint_depth_m) AS (
  VALUES
    ('habitat',            -95.0,   55.0, 12.0, 28.0, 22.0),
    ('life_support_hub',   -35.0,   55.0, 12.0, 24.0, 24.0),
    ('solar',             -175.0,  165.0,  0.0, 60.0, 40.0),
    ('battery_storage',   -105.0,  145.0,  0.0, 24.0, 24.0),
    ('warehouse',           55.0,  -35.0, 18.0, 36.0, 28.0),
    ('surface_workshop',    -5.0,  -45.0, 18.0, 32.0, 26.0),
    ('rover_yard',          80.0, -115.0, 18.0, 42.0, 30.0),
    ('surface_comms',      -10.0,  155.0,  0.0, 18.0, 18.0),
    ('landing_pad_moon',   205.0, -165.0, 28.0, 90.0, 70.0)
)
INSERT INTO tile_entities
  (profile_id,location_id,entity_type,entity_id,owner_class,owner_id,is_state_owned,
   placement_mode,x_m,y_m,rotation_deg,footprint_width_m,footprint_depth_m,
   spatial_region_id,terrain_dataset_id,terrain_status,status,condition)
SELECT
  NULL,m.id,'building',s.entity_id,'STATE',NULL,true,
  'world',s.x_m,s.y_m,s.rotation_deg,s.footprint_width_m,s.footprint_depth_m,
  'moon-shackleton-alpha','moon_lro_lola_118m','resolved','active',100
FROM moon_location m
CROSS JOIN seed s
WHERE NOT EXISTS (
  SELECT 1 FROM tile_entities te
  WHERE te.location_id = m.id
    AND te.entity_type = 'building'
    AND te.entity_id = s.entity_id
    AND te.spatial_region_id = 'moon-shackleton-alpha'
);
