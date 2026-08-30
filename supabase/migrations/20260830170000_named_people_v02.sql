-- NOXIA-LIVING-0002 — Named people / narrative identity layer
-- First controlled named actor: Dr. Amara Reyes, Tharsis Hub
-- Parent issue: #19

SET search_path TO public;

-- Narrative/public identity belongs on the person record.
-- Simulation truth remains in assignments, needs, skills, relationships,
-- population_events and person_knowledge.
ALTER TABLE people
  ADD COLUMN IF NOT EXISTS person_key text,
  ADD COLUMN IF NOT EXISTS bio_short text,
  ADD COLUMN IF NOT EXISTS public_role text,
  ADD COLUMN IF NOT EXISTS traits jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS external_person_ref text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_people_person_key
  ON people (person_key)
  WHERE person_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_people_external_person_ref
  ON people (external_person_ref)
  WHERE external_person_ref IS NOT NULL;

-- Stable named person identity. No age/birth year is canonized yet.
INSERT INTO people (
  id,
  person_key,
  display_name,
  birth_year,
  current_location_id,
  simulation_tier,
  activity_state,
  bio_short,
  public_role,
  traits,
  last_action,
  last_decision_factors,
  last_tick
)
SELECT
  '10000000-0000-0000-0000-000000000001'::uuid,
  'amara-reyes',
  'Dr. Amara Reyes',
  NULL,
  l.id,
  'active',
  'working',
  'Leitet die medizinische Versorgung von Tharsis Hub und verantwortet autonome Diagnose, Triage und Krisenpriorisierung.',
  'Leitung Medical Center · Tharsis Hub',
  '{
    "decision_style": "evidence_first",
    "risk_posture": "cautious_under_uncertainty",
    "priority": "crew_health_and_system_resilience"
  }'::jsonb,
  'medical_center_shift',
  '{"reason":"initial_named_actor_seed"}'::jsonb,
  0
FROM locations l
WHERE l.slug = 'mars'
ON CONFLICT (id) DO UPDATE SET
  person_key = EXCLUDED.person_key,
  display_name = EXCLUDED.display_name,
  current_location_id = EXCLUDED.current_location_id,
  simulation_tier = EXCLUDED.simulation_tier,
  bio_short = EXCLUDED.bio_short,
  public_role = EXCLUDED.public_role,
  traits = EXCLUDED.traits,
  updated_at = now();

-- Work assignment at Tharsis Hub. A concrete Medical Center tile entity can be
-- attached later when the vertical slice materializes that building in-world.
INSERT INTO person_assignments (
  person_id,
  assignment_type,
  location_id,
  tile_entity_id,
  employer_actor_id,
  role_code,
  starts_tick,
  is_active
)
SELECT
  '10000000-0000-0000-0000-000000000001'::uuid,
  'work',
  l.id,
  NULL,
  NULL,
  'medical_center_lead',
  0,
  true
FROM locations l
WHERE l.slug = 'mars'
  AND NOT EXISTS (
    SELECT 1
    FROM person_assignments pa
    WHERE pa.person_id = '10000000-0000-0000-0000-000000000001'::uuid
      AND pa.assignment_type = 'work'
      AND pa.is_active = true
  );

-- Initial needs are neutral. Pressure systems change these values later.
INSERT INTO person_needs (person_id, need_code, satisfaction, updated_tick)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'sustenance', 1.0, 0),
  ('10000000-0000-0000-0000-000000000001', 'rest',       1.0, 0),
  ('10000000-0000-0000-0000-000000000001', 'safety',     1.0, 0),
  ('10000000-0000-0000-0000-000000000001', 'social',     1.0, 0),
  ('10000000-0000-0000-0000-000000000001', 'purpose',    1.0, 0)
ON CONFLICT (person_id, need_code) DO NOTHING;

-- Normalized gameplay competencies, not external real-world credentials.
INSERT INTO person_skills (person_id, skill_code, level, experience, updated_tick)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'medicine',              0.90, 0, 0),
  ('10000000-0000-0000-0000-000000000001', 'emergency_medicine',    0.88, 0, 0),
  ('10000000-0000-0000-0000-000000000001', 'triage',                0.86, 0, 0),
  ('10000000-0000-0000-0000-000000000001', 'colony_health',         0.82, 0, 0),
  ('10000000-0000-0000-0000-000000000001', 'systems_risk_assessment',0.72, 0, 0)
ON CONFLICT (person_id, skill_code) DO UPDATE SET
  level = EXCLUDED.level,
  updated_at = now();

-- One append-only origin event. This makes the actor's introduction observable
-- to later scenario/history UI without inventing dialogue.
INSERT INTO population_events (
  tick,
  event_type,
  actor_person_id,
  location_id,
  subject_type,
  subject_ref,
  payload
)
SELECT
  0,
  'named_actor_initialized',
  '10000000-0000-0000-0000-000000000001'::uuid,
  l.id,
  'person',
  'amara-reyes',
  '{"role":"medical_center_lead","source":"NOXIA-LIVING-0002"}'::jsonb
FROM locations l
WHERE l.slug = 'mars'
  AND NOT EXISTS (
    SELECT 1
    FROM population_events pe
    WHERE pe.actor_person_id = '10000000-0000-0000-0000-000000000001'::uuid
      AND pe.event_type = 'named_actor_initialized'
  );

-- Deliberately no person_relationships seed yet: relationships should involve
-- another real person record, not a placeholder.
