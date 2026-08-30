-- NOXIA-LIVING-0003 — Tharsis named cast v0.1
-- Parent: #16 / #19 / #26
-- Adds six persistent named people alongside Dr. Amara Reyes.

SET search_path TO public;

-- Stable named people. Birth years and external identities remain unset until canonized.
WITH mars AS (
  SELECT id AS location_id FROM locations WHERE slug = 'mars' LIMIT 1
), seed(id, person_key, display_name, public_role, bio_short, traits, last_action) AS (
  VALUES
    ('10000000-0000-0000-0000-000000000002'::uuid, 'leila-haddad', 'Leila Haddad',
     'Leitung Wasser- und Life-Support-Systeme · Tharsis Hub',
     'Verantwortet Wasserkreisläufe, Life-Support-Schnittstellen und die technische Priorisierung bei Versorgungsengpässen.',
     '{"decision_style":"systems_first","risk_posture":"preventive","priority":"water_and_life_support_continuity"}'::jsonb,
     'systems_shift'),
    ('10000000-0000-0000-0000-000000000003'::uuid, 'tomasz-zielinski', 'Tomasz Zieliński',
     'Leitung Fabrication Center · Tharsis Hub',
     'Koordiniert Fertigung, Reparaturkapazität und die lokale Herstellung kritischer Ersatzteile für die Kolonie.',
     '{"decision_style":"pragmatic","risk_posture":"repair_before_replace","priority":"maintain_local_capability"}'::jsonb,
     'fabrication_shift'),
    ('10000000-0000-0000-0000-000000000004'::uuid, 'nia-okonkwo', 'Nia Okonkwo',
     'Leitung Geologie und Probenanalyse · Tharsis Hub',
     'Verbindet Prospektionsdaten, Probenanalyse und geologische Bewertung zu belastbaren Entscheidungen über Ressourcen und Baugrund.',
     '{"decision_style":"evidence_first","risk_posture":"cautious_under_ambiguity","priority":"measurement_quality_and_interpretation"}'::jsonb,
     'lab_shift'),
    ('10000000-0000-0000-0000-000000000005'::uuid, 'kenji-sato', 'Kenji Sato',
     'Leitung Roverbetrieb · Tharsis Hub',
     'Plant Rovereinsätze, Außenmissionen und Probenlogistik und entscheidet über Reichweite, Reserve und Fahrzeugverfügbarkeit.',
     '{"decision_style":"operations_first","risk_posture":"reserve_margin","priority":"crew_and_vehicle_return"}'::jsonb,
     'rover_ops_shift'),
    ('10000000-0000-0000-0000-000000000006'::uuid, 'elena-varga', 'Elena Varga',
     'Infrastrukturkoordination · Verwaltung Tharsis Hub',
     'Koordiniert konkurrierende Infrastrukturbedarfe der Kolonie und übersetzt technische Engpässe in priorisierte Ausbauentscheidungen.',
     '{"decision_style":"tradeoff_balancing","risk_posture":"institutional","priority":"colony_resilience_and_fair_allocation"}'::jsonb,
     'coordination_shift'),
    ('10000000-0000-0000-0000-000000000007'::uuid, 'marcus-chen', 'Marcus Chen',
     'Lokale Schnittstelle HeliosCorp · Tharsis Hub',
     'Verhandelt Lieferverträge, Infrastrukturzugang und kommerzielle Kooperationen zwischen HeliosCorp und der Kolonie.',
     '{"decision_style":"contractual","risk_posture":"commercial","priority":"reliable_exchange_and_position"}'::jsonb,
     'liaison_shift')
)
INSERT INTO people (
  id, person_key, display_name, birth_year, current_location_id,
  simulation_tier, activity_state, bio_short, public_role, traits,
  external_person_ref, last_action, last_decision_factors, last_tick
)
SELECT
  s.id, s.person_key, s.display_name, NULL, m.location_id,
  'active', 'working', s.bio_short, s.public_role, s.traits,
  NULL, s.last_action, '{"reason":"tharsis_named_cast_seed"}'::jsonb, 0
FROM seed s CROSS JOIN mars m
ON CONFLICT (id) DO UPDATE SET
  person_key = EXCLUDED.person_key,
  display_name = EXCLUDED.display_name,
  current_location_id = EXCLUDED.current_location_id,
  simulation_tier = EXCLUDED.simulation_tier,
  bio_short = EXCLUDED.bio_short,
  public_role = EXCLUDED.public_role,
  traits = EXCLUDED.traits,
  updated_at = now();

-- Work assignments. Concrete building tile ids are attached later by the vertical slice.
WITH mars AS (
  SELECT id AS location_id FROM locations WHERE slug = 'mars' LIMIT 1
), roles(person_id, role_code, employer_actor_id) AS (
  VALUES
    ('10000000-0000-0000-0000-000000000002'::uuid, 'water_life_support_lead', NULL::uuid),
    ('10000000-0000-0000-0000-000000000003'::uuid, 'fabrication_center_lead', NULL::uuid),
    ('10000000-0000-0000-0000-000000000004'::uuid, 'geology_lab_lead', NULL::uuid),
    ('10000000-0000-0000-0000-000000000005'::uuid, 'rover_operations_lead', NULL::uuid),
    ('10000000-0000-0000-0000-000000000006'::uuid, 'infrastructure_coordinator', NULL::uuid),
    ('10000000-0000-0000-0000-000000000007'::uuid, 'helioscorp_liaison', '00000000-0000-0000-0000-000000000001'::uuid)
)
INSERT INTO person_assignments (
  person_id, assignment_type, location_id, tile_entity_id,
  employer_actor_id, role_code, starts_tick, is_active
)
SELECT r.person_id, 'work', m.location_id, NULL, r.employer_actor_id, r.role_code, 0, true
FROM roles r CROSS JOIN mars m
WHERE NOT EXISTS (
  SELECT 1 FROM person_assignments pa
  WHERE pa.person_id = r.person_id
    AND pa.assignment_type = 'work'
    AND pa.is_active = true
);

-- Neutral initial needs for all six people.
INSERT INTO person_needs (person_id, need_code, satisfaction, updated_tick)
SELECT p.id, n.need_code, 1.0, 0
FROM people p
CROSS JOIN (VALUES ('sustenance'), ('rest'), ('safety'), ('social'), ('purpose')) AS n(need_code)
WHERE p.person_key IN ('leila-haddad','tomasz-zielinski','nia-okonkwo','kenji-sato','elena-varga','marcus-chen')
ON CONFLICT (person_id, need_code) DO NOTHING;

-- Gameplay competencies. Values are normalized simulation capabilities, not real-world credentials.
INSERT INTO person_skills (person_id, skill_code, level, experience, updated_tick)
VALUES
  ('10000000-0000-0000-0000-000000000002','water_systems',0.92,0,0),
  ('10000000-0000-0000-0000-000000000002','life_support',0.88,0,0),
  ('10000000-0000-0000-0000-000000000002','maintenance_diagnostics',0.78,0,0),
  ('10000000-0000-0000-0000-000000000002','systems_risk_assessment',0.80,0,0),

  ('10000000-0000-0000-0000-000000000003','fabrication',0.91,0,0),
  ('10000000-0000-0000-0000-000000000003','materials_processing',0.82,0,0),
  ('10000000-0000-0000-0000-000000000003','repair_planning',0.86,0,0),
  ('10000000-0000-0000-0000-000000000003','inventory_substitution',0.75,0,0),

  ('10000000-0000-0000-0000-000000000004','geology',0.93,0,0),
  ('10000000-0000-0000-0000-000000000004','mineralogy',0.89,0,0),
  ('10000000-0000-0000-0000-000000000004','sample_analysis',0.90,0,0),
  ('10000000-0000-0000-0000-000000000004','measurement_interpretation',0.87,0,0),

  ('10000000-0000-0000-0000-000000000005','rover_operations',0.92,0,0),
  ('10000000-0000-0000-0000-000000000005','field_logistics',0.86,0,0),
  ('10000000-0000-0000-0000-000000000005','route_risk_assessment',0.84,0,0),
  ('10000000-0000-0000-0000-000000000005','sample_recovery',0.76,0,0),

  ('10000000-0000-0000-0000-000000000006','infrastructure_planning',0.88,0,0),
  ('10000000-0000-0000-0000-000000000006','resource_prioritization',0.84,0,0),
  ('10000000-0000-0000-0000-000000000006','coordination',0.91,0,0),
  ('10000000-0000-0000-0000-000000000006','governance_operations',0.78,0,0),

  ('10000000-0000-0000-0000-000000000007','contract_negotiation',0.89,0,0),
  ('10000000-0000-0000-0000-000000000007','trade_logistics',0.82,0,0),
  ('10000000-0000-0000-0000-000000000007','market_analysis',0.85,0,0),
  ('10000000-0000-0000-0000-000000000007','stakeholder_management',0.81,0,0)
ON CONFLICT (person_id, skill_code) DO UPDATE SET
  level = EXCLUDED.level,
  updated_at = now();

-- Append-only initialization events, one per newly introduced person.
WITH mars AS (
  SELECT id AS location_id FROM locations WHERE slug = 'mars' LIMIT 1
)
INSERT INTO population_events (
  tick, event_type, actor_person_id, location_id,
  subject_type, subject_ref, payload
)
SELECT 0, 'named_actor_initialized', p.id, m.location_id,
       'person', p.person_key,
       jsonb_build_object('role', pa.role_code, 'source', 'NOXIA-LIVING-0003')
FROM people p
CROSS JOIN mars m
LEFT JOIN person_assignments pa
  ON pa.person_id = p.id AND pa.assignment_type = 'work' AND pa.is_active = true
WHERE p.person_key IN ('leila-haddad','tomasz-zielinski','nia-okonkwo','kenji-sato','elena-varga','marcus-chen')
  AND NOT EXISTS (
    SELECT 1 FROM population_events pe
    WHERE pe.actor_person_id = p.id
      AND pe.event_type = 'named_actor_initialized'
  );

-- Deliberately no relationship seed yet. Relationships are introduced only when
-- canon or simulation events justify them.
