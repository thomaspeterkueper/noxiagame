import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const must = (name, text, tokens) => {
  for (const token of tokens) {
    if (!text.includes(token)) throw new Error(`${name}: missing ${JSON.stringify(token)}`);
  }
  return name;
};
const mustNot = (name, text, tokens) => {
  for (const token of tokens) {
    if (text.includes(token)) throw new Error(`${name}: forbidden ${JSON.stringify(token)}`);
  }
  return name;
};

const actors = read('supabase/migrations/20260718100000_precreate_actors.sql');
const baseline = read('supabase/migrations/20260719000000_baseline.sql');
const npcEconomy = read('supabase/migrations/_archive/014_npc_economy.sql');
const living = read('supabase/migrations/20260825161000_living_population_v01.sql');
const colony = read('app/api/game/colony/route.ts');
const adr = read('docs/decisions/ADR-npcs-sind-spieler.md');

const checks = [];
checks.push(must('player identity remains profile-backed', baseline, [
  'CREATE TABLE IF NOT EXISTS profiles',
  'references auth.users(id) on delete cascade',
]));
checks.push(must('actors remain independent world actors', actors, [
  'CREATE TABLE IF NOT EXISTS actors',
  'kind             text NOT NULL',
  'decision_weights jsonb',
]));
checks.push(mustNot('actors do not require player profiles', actors, [
  'profile_id uuid NOT NULL',
  'references auth.users',
]));
checks.push(must('NPC firms own through actor identity', npcEconomy, [
  'add column if not exists actor_id uuid references actors(id)',
  '(profile_id is not null)::int + (actor_id is not null)::int + (is_state_owned)::int = 1',
]));
checks.push(must('NPC firm seeds do not fabricate profiles', npcEconomy, [
  "'npc_firm'",
  'insert into tile_entities (actor_id, location_id',
]));
checks.push(must('natural people remain separate from firms', living, [
  'Natürliche Personen werden getrennt von bestehenden NPC-Firmen modelliert.',
  'CREATE TABLE IF NOT EXISTS people',
]));
checks.push(mustNot('people do not require player profiles', living, [
  'profile_id          uuid NOT NULL REFERENCES profiles',
  'profile_id uuid NOT NULL REFERENCES profiles',
]));
checks.push(must('employment points to actor explicitly', living, [
  'employer_actor_id  uuid REFERENCES actors(id)',
  'role_code          text',
  "CHECK (assignment_type = 'work' OR employer_actor_id IS NULL)",
]));
checks.push(must('governor mutation authenticates explicit player identity', colony, [
  "service.auth.getUser(token)",
  'userId !== location.governor_profile_id',
  "error: 'Nur der Governor darf Steuern setzen'",
]));
checks.push(mustNot('governor rights are not inferred from ownership', colony, [
  'topOwners.some',
  'ownerMap[userId]',
]));
checks.push(must('ADR states NPCs are not players', adr, [
  'NPCs sind **keine Spieler**',
  'Gameplay-Symmetrie',
  'Dummy-Profile',
]));
checks.push(must('ADR rejects actor id as authentication', adr, [
  'Kein Mechanismus darf `actor_id` als Ersatz für `auth.uid()` verwenden.',
]));
checks.push(must('ADR rejects implicit authority from employment or ownership', adr, [
  'keine universelle Vertretungs- oder Administrationsvollmacht',
  'Keine Rolle darf allein aus Eigentum, Beschäftigung oder Standort abgeleitet werden.',
]));

console.log(`NOXIA Core actor/player/person/permission invariant check passed (${checks.length} checks).`);
for (const check of checks) console.log(`- ${check}`);
