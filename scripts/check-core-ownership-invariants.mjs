import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(file, 'utf8');
const failures = [];
const passes = [];

function pass(label) {
  passes.push(label);
}

function fail(label, detail) {
  failures.push(`${label}: ${detail}`);
}

function requireTokens(label, content, tokens) {
  let ok = true;
  for (const token of tokens) {
    if (!content.includes(token)) {
      ok = false;
      fail(label, `missing token ${JSON.stringify(token)}`);
    }
  }
  if (ok) pass(label);
}

function functionBlock(content, name) {
  const start = content.toLowerCase().indexOf(`create or replace function public.${name.toLowerCase()}`);
  if (start < 0) return null;
  const next = content.toLowerCase().indexOf('create or replace function public.', start + 1);
  return content.slice(start, next < 0 ? content.length : next);
}

function updateStatements(block, table) {
  if (!block) return [];
  const escaped = table.replaceAll('.', '\\.');
  return [...block.matchAll(new RegExp(`update\\s+${escaped}[\\s\\S]*?;`, 'gi'))].map((m) => m[0]);
}

const vehicleFile = 'supabase/migrations/20260911063018_vehicle_instance_core.sql';
const facilityFile = 'supabase/migrations/20260911100200_facility_inventory_provisioning.sql';
const custodyFile = 'supabase/migrations/20260911111420_custody_marketplace_core.sql';
const populationFile = 'supabase/migrations/20260825161000_living_population_v01.sql';
const worldFile = 'supabase/migrations/20260720300000_weltarchitektur_phase1.sql';
const financeFile = 'supabase/migrations/20260910090000_atomic_finance_asset_commands.sql';

const vehicle = read(vehicleFile);
const facility = read(facilityFile);
const custody = read(custodyFile);
const population = read(populationFile);
const world = read(worldFile);
const finance = read(financeFile);

// 1. Ownership, crew and location are distinct state dimensions on vehicles.
requireTokens('vehicle dimensions remain distinct', vehicle, [
  'owner_profile_id uuid references public.profiles',
  'location_id uuid references public.locations',
  'current_node_inventory_id uuid references public.logistics_inventories',
  "crew_ids uuid[] not null default '{}'::uuid[]",
]);

// 2. Transport replay may change status/location/node, but must not mutate ownership or crew.
const syncVehicle = functionBlock(vehicle, 'noxia_sync_vehicle_transport_state');
if (!syncVehicle) {
  fail('vehicle transport replay preserves ownership and crew', 'missing noxia_sync_vehicle_transport_state');
} else {
  const updates = updateStatements(syncVehicle, 'public.vehicle_instances');
  if (updates.length === 0) {
    fail('vehicle transport replay preserves ownership and crew', 'no vehicle update statements found');
  } else {
    const illegal = updates.filter((statement) => /\b(owner_profile_id|crew_ids)\b/i.test(statement));
    if (illegal.length > 0) {
      fail('vehicle transport replay preserves ownership and crew', 'transport update writes owner_profile_id or crew_ids');
    } else {
      pass('vehicle transport replay preserves ownership and crew');
    }
  }
}

// 3. Native vehicle cargo mirrors the vehicle owner without making node/location ownership authoritative.
const createVehicle = functionBlock(vehicle, 'noxia_create_vehicle_instance');
if (!createVehicle) {
  fail('vehicle native inventory mirrors vehicle owner', 'missing noxia_create_vehicle_instance');
} else {
  requireTokens('vehicle native inventory mirrors vehicle owner', createVehicle, [
    'insert into public.vehicle_instances',
    'p_owner_profile_id',
    'insert into public.logistics_inventories',
    "'vehicle','native','vehicle_instance'",
  ]);
}

// 4. Facility inventory ownership derives only from the concrete tile_entity, never the containing location.
const ensureFacility = functionBlock(facility, 'noxia_ensure_facility_inventory');
if (!ensureFacility) {
  fail('facility ownership derives from tile entity', 'missing noxia_ensure_facility_inventory');
} else {
  requireTokens('facility ownership derives from tile entity', ensureFacility, [
    "when v_entity.owner_class = 'PLAYER' then coalesce(v_entity.owner_id, v_entity.profile_id)",
    'v_owner_profile_id',
    'insert into public.logistics_inventories',
  ]);
  if (/\bfrom\s+public\.locations\b/i.test(ensureFacility) || /\blocations\.owner_id\b/i.test(ensureFacility)) {
    fail('facility does not inherit location owner', 'facility provisioning reads location ownership');
  } else {
    pass('facility does not inherit location owner');
  }
}

// 5. Custody is explicitly separate from physical host ownership.
requireTokens('private custody remains separate from host', custody, [
  'create table if not exists public.storage_accounts',
  'host_inventory_id uuid not null references public.logistics_inventories',
  'owner_profile_id uuid not null references public.profiles',
  "subject_type = 'storage_account'",
]);

// 6. Population assignments can bind to buildings without writing building ownership.
requireTokens('population assignment remains occupancy not ownership', population, [
  "assignment_type IN ('home', 'work', 'temporary')",
  'tile_entity_id     uuid REFERENCES tile_entities(id) ON DELETE SET NULL',
  'employer_actor_id  uuid REFERENCES actors(id) ON DELETE SET NULL',
]);
if (/update\s+(public\.)?tile_entities[\s\S]{0,300}\b(owner_id|owner_class|profile_id)\b/i.test(population)) {
  fail('population assignment cannot mutate building ownership', 'living-population migration updates tile_entities ownership');
} else {
  pass('population assignment cannot mutate building ownership');
}

// 7. locations.owner_id remains explicitly a founder/location relation.
requireTokens('location ownership remains legacy founder semantics', world, [
  '-- Eigentümer (Gründer)',
  'ADD COLUMN IF NOT EXISTS owner_id',
]);

// 8. Legacy ship ownership/cargo stays isolated from the shared vehicle/logistics model until explicit convergence.
const spotTrade = functionBlock(finance, 'noxia_spot_trade');
if (!spotTrade) {
  fail('legacy ship trade remains isolated', 'missing noxia_spot_trade');
} else {
  requireTokens('legacy ship trade remains isolated', spotTrade, [
    'from public.ships',
    'from public.ship_cargo',
    'insert into public.ship_cargo',
  ]);
  if (/\bvehicle_instances\b|\blogistics_inventories\b/i.test(spotTrade)) {
    fail('legacy ship trade does not silently converge', 'spot-trade function touches shared vehicle/logistics persistence');
  } else {
    pass('legacy ship trade does not silently converge');
  }
}

if (failures.length > 0) {
  console.error('NOXIA Core ownership/custody/occupancy invariant check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  console.error('\nIf this is an intentional architecture change, update docs/core/OWNERSHIP_CUSTODY_USAGE_MAP.md and this executable guard together.');
  process.exit(1);
}

console.log(`NOXIA Core ownership/custody/occupancy invariant check passed (${passes.length} checks).`);
for (const label of passes) console.log(`- ${label}`);
