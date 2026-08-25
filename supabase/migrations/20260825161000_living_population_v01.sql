-- supabase/migrations/20260825161000_living_population_v01.sql
-- NOXIA-LIVING-0001 — Living Population v0.1
-- Erstellt: 25.08.2026
--
-- Natürliche Personen werden getrennt von bestehenden NPC-Firmen modelliert.
-- actors/npc_ledger bleiben Source of Truth für Firmenakteure und deren Wirtschaft.
-- locations/tile_entities bleiben Source of Truth für Orte und Gebäude.

SET search_path TO public;

-- ══════════════════════════════════════════════════════════════════
-- 1. Personen
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS people (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name           text NOT NULL CHECK (char_length(trim(display_name)) > 0),
  birth_year             integer,
  current_location_id    uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  simulation_tier        text NOT NULL DEFAULT 'active'
    CHECK (simulation_tier IN ('active', 'background', 'aggregate')),
  activity_state         text NOT NULL DEFAULT 'idle'
    CHECK (activity_state IN ('idle', 'travelling', 'working', 'resting', 'socialising', 'inspecting')),
  last_action            text,
  last_decision_factors  jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_tick              bigint,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_people_location
  ON people (current_location_id);

CREATE INDEX IF NOT EXISTS idx_people_simulation_tier
  ON people (simulation_tier);

-- ══════════════════════════════════════════════════════════════════
-- 2. Zuweisungen: Wohnen / Arbeiten / temporär
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS person_assignments (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id          uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  assignment_type    text NOT NULL
    CHECK (assignment_type IN ('home', 'work', 'temporary')),
  location_id        uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  tile_entity_id     uuid REFERENCES tile_entities(id) ON DELETE SET NULL,
  employer_actor_id  uuid REFERENCES actors(id) ON DELETE SET NULL,
  role_code          text,
  starts_tick        bigint,
  ends_tick          bigint,
  is_active          boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_tick IS NULL OR starts_tick IS NULL OR ends_tick >= starts_tick),
  CHECK (assignment_type = 'work' OR employer_actor_id IS NULL)
);

CREATE INDEX IF NOT EXISTS idx_person_assignments_person
  ON person_assignments (person_id, is_active);

CREATE INDEX IF NOT EXISTS idx_person_assignments_location
  ON person_assignments (location_id, assignment_type, is_active);

CREATE INDEX IF NOT EXISTS idx_person_assignments_tile_entity
  ON person_assignments (tile_entity_id)
  WHERE tile_entity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_person_assignments_employer
  ON person_assignments (employer_actor_id)
  WHERE employer_actor_id IS NOT NULL;

-- Pro Person höchstens ein aktiver Wohnort und ein aktiver Arbeitsplatz.
CREATE UNIQUE INDEX IF NOT EXISTS uq_person_active_home
  ON person_assignments (person_id)
  WHERE assignment_type = 'home' AND is_active = true;

CREATE UNIQUE INDEX IF NOT EXISTS uq_person_active_work
  ON person_assignments (person_id)
  WHERE assignment_type = 'work' AND is_active = true;

-- ══════════════════════════════════════════════════════════════════
-- 3. Bedürfnisse
-- satisfaction: 0 = unbefriedigt, 1 = vollständig befriedigt
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS person_needs (
  person_id       uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  need_code       text NOT NULL
    CHECK (need_code IN ('sustenance', 'rest', 'safety', 'social', 'purpose')),
  satisfaction    numeric(5,4) NOT NULL DEFAULT 1.0
    CHECK (satisfaction >= 0 AND satisfaction <= 1),
  updated_tick    bigint,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (person_id, need_code)
);

CREATE INDEX IF NOT EXISTS idx_person_needs_pressure
  ON person_needs (need_code, satisfaction);

-- ══════════════════════════════════════════════════════════════════
-- 4. Kompetenzen / Erfahrung
-- Skill-Codes bleiben bewusst erweiterbar, ohne globales DB-Enum.
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS person_skills (
  person_id       uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  skill_code      text NOT NULL CHECK (char_length(trim(skill_code)) > 0),
  level           numeric(5,4) NOT NULL DEFAULT 0
    CHECK (level >= 0 AND level <= 1),
  experience      numeric NOT NULL DEFAULT 0 CHECK (experience >= 0),
  updated_tick    bigint,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (person_id, skill_code)
);

CREATE INDEX IF NOT EXISTS idx_person_skills_code_level
  ON person_skills (skill_code, level DESC);

-- ══════════════════════════════════════════════════════════════════
-- 5. Beziehungen
-- Richtungsbezogen: Vertrauen/Affinität müssen nicht symmetrisch sein.
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS person_relationships (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id              uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  other_person_id        uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  relationship_type      text NOT NULL DEFAULT 'acquaintance',
  familiarity            numeric(5,4) NOT NULL DEFAULT 0
    CHECK (familiarity >= 0 AND familiarity <= 1),
  trust                  numeric(5,4) NOT NULL DEFAULT 0.5
    CHECK (trust >= 0 AND trust <= 1),
  affinity               numeric(5,4) NOT NULL DEFAULT 0.5
    CHECK (affinity >= 0 AND affinity <= 1),
  last_interaction_tick  bigint,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CHECK (person_id <> other_person_id),
  UNIQUE (person_id, other_person_id)
);

CREATE INDEX IF NOT EXISTS idx_person_relationships_other
  ON person_relationships (other_person_id);

-- ══════════════════════════════════════════════════════════════════
-- 6. Relevante Ereignisse
-- Append-only im Anwendungsmodell; keine triviale Tick-Telemetrie.
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS population_events (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tick               bigint NOT NULL,
  event_type         text NOT NULL CHECK (char_length(trim(event_type)) > 0),
  actor_person_id    uuid REFERENCES people(id) ON DELETE SET NULL,
  related_person_id  uuid REFERENCES people(id) ON DELETE SET NULL,
  location_id        uuid REFERENCES locations(id) ON DELETE SET NULL,
  subject_type       text,
  subject_ref        text,
  payload            jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at        timestamptz NOT NULL DEFAULT now(),
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_population_events_tick
  ON population_events (tick DESC);

CREATE INDEX IF NOT EXISTS idx_population_events_actor
  ON population_events (actor_person_id, tick DESC)
  WHERE actor_person_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_population_events_location
  ON population_events (location_id, tick DESC)
  WHERE location_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_population_events_type
  ON population_events (event_type, tick DESC);

-- ══════════════════════════════════════════════════════════════════
-- 7. Individuelles Wissen
-- Nicht mit globalem KG-/SSF-Wissen verwechseln: dies ist der persönliche
-- Kenntnisstand einer NOXIA-Person zu einem konkreten Subjekt.
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS person_knowledge (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id        uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  subject_type     text NOT NULL CHECK (char_length(trim(subject_type)) > 0),
  subject_ref      text NOT NULL CHECK (char_length(trim(subject_ref)) > 0),
  knowledge_type   text NOT NULL CHECK (char_length(trim(knowledge_type)) > 0),
  confidence       numeric(5,4) NOT NULL DEFAULT 0.5
    CHECK (confidence >= 0 AND confidence <= 1),
  learned_tick     bigint NOT NULL,
  source_event_id  uuid REFERENCES population_events(id) ON DELETE SET NULL,
  details          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (person_id, subject_type, subject_ref, knowledge_type)
);

CREATE INDEX IF NOT EXISTS idx_person_knowledge_person
  ON person_knowledge (person_id, learned_tick DESC);

CREATE INDEX IF NOT EXISTS idx_person_knowledge_subject
  ON person_knowledge (subject_type, subject_ref);

-- ══════════════════════════════════════════════════════════════════
-- 8. RLS / Zugriff
-- v0.1 wird serverseitig simuliert. Individuelles NPC-Wissen wird nicht
-- pauschal an Clients veröffentlicht.
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_needs ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE population_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_knowledge ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "people_service" ON people;
CREATE POLICY "people_service" ON people
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "person_assignments_service" ON person_assignments;
CREATE POLICY "person_assignments_service" ON person_assignments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "person_needs_service" ON person_needs;
CREATE POLICY "person_needs_service" ON person_needs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "person_skills_service" ON person_skills;
CREATE POLICY "person_skills_service" ON person_skills
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "person_relationships_service" ON person_relationships;
CREATE POLICY "person_relationships_service" ON person_relationships
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "population_events_service" ON population_events;
CREATE POLICY "population_events_service" ON population_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "person_knowledge_service" ON person_knowledge;
CREATE POLICY "person_knowledge_service" ON person_knowledge
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT ALL ON people TO service_role;
GRANT ALL ON person_assignments TO service_role;
GRANT ALL ON person_needs TO service_role;
GRANT ALL ON person_skills TO service_role;
GRANT ALL ON person_relationships TO service_role;
GRANT ALL ON population_events TO service_role;
GRANT ALL ON person_knowledge TO service_role;

-- Keine Seed-Personen und kein Cron in diesem Schritt.
-- Nächster Schritt laut ADR: deterministische Tick-Logik, danach genau eine
-- kontrollierte Testpopulation an einem existierenden Standort.
