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

function branchBlock(content, startToken, endToken) {
  const start = content.indexOf(startToken);
  if (start < 0) return null;
  const end = endToken ? content.indexOf(endToken, start + startToken.length) : -1;
  return content.slice(start, end < 0 ? content.length : end);
}

const vehicleFile = 'supabase/migrations/20260911063018_vehicle_instance_core.sql';
const transitFile = 'supabase/migrations/20260910093000_atomic_transit_commands.sql';
const geodeticFile = 'supabase/migrations/20260909180000_global_geodetic_world_positions.sql';

const vehicle = read(vehicleFile);
const transit = read(transitFile);
const geodetic = read(geodeticFile);

// 1. Broad location and concrete node membership are distinct vehicle dimensions.
requireTokens('vehicle location and node remain distinct', vehicle, [
  'location_id uuid references public.locations',
  'current_node_inventory_id uuid references public.logistics_inventories',
]);

// 2. Entering transit must clear concrete node membership.
const syncVehicle = functionBlock(vehicle, 'noxia_sync_vehicle_transport_state');
if (!syncVehicle) {
  fail('vehicle in-transit clears node membership', 'missing noxia_sync_vehicle_transport_state');
} else {
  const inTransit = branchBlock(syncVehicle, "elsif new.status='in_transit' then", "elsif new.status in ('arrived','unloading') then");
  if (!inTransit) {
    fail('vehicle in-transit clears node membership', 'missing in_transit branch');
  } else {
    requireTokens('vehicle in-transit clears node membership', inTransit, [
      "set status='in_transit',current_node_inventory_id=null,updated_at=now()",
    ]);
    if (/\blocation_id\s*=/.test(inTransit)) {
      fail('vehicle broad location remains coarse during transit', 'in_transit branch rewrites location_id');
    } else {
      pass('vehicle broad location remains coarse during transit');
    }
  }
}

// 3. Arrival/completion binds destination node and updates broad location from the destination node.
if (syncVehicle) {
  const arrival = branchBlock(syncVehicle, "elsif new.status in ('arrived','unloading') then", "elsif new.status='completed' then");
  const completed = branchBlock(syncVehicle, "elsif new.status='completed' then", "elsif new.status='cancelled' then");
  if (!arrival || !completed) {
    fail('vehicle arrival binds destination node/location', 'missing arrival/completed transport branches');
  } else {
    requireTokens('vehicle arrival binds destination node/location', `${arrival}\n${completed}`, [
      'current_node_inventory_id=new.destination_inventory_id',
      'location_id=coalesce(v_target_location,location_id)',
    ]);
  }
}

// 4. Cancellation returns to the source node/location rather than inventing a third state.
if (syncVehicle) {
  const cancelled = branchBlock(syncVehicle, "elsif new.status='cancelled' then", 'end if;');
  if (!cancelled) {
    fail('vehicle cancellation returns to source', 'missing cancelled branch');
  } else {
    requireTokens('vehicle cancellation returns to source', cancelled, [
      'current_node_inventory_id=new.source_inventory_id',
      'location_id=coalesce(v_source_location,location_id)',
    ]);
  }
}

// 5. Source/target broad locations are derived from concrete logistics nodes for transport replay.
if (syncVehicle) {
  requireTokens('transport resolves node locations explicitly', syncVehicle, [
    'select location_id into v_source_location from public.logistics_inventories where id=new.source_inventory_id',
    'select location_id into v_target_location from public.logistics_inventories where id=new.destination_inventory_id',
  ]);
}

// 6. Legacy ship transit reservation is separate from actual docking occupancy.
requireTokens('legacy reservation and docking are separate', transit, [
  'create table if not exists public.ship_transit_pad_reservations',
  'distinct from actual docking occupancy',
  'delete from public.ship_docking_assignments where ship_id = v_ship.id',
  'insert into public.ship_transit_pad_reservations',
]);

// 7. Starting legacy transit must not teleport ships.location.
const startTransit = functionBlock(transit, 'noxia_start_transit');
if (!startTransit) {
  fail('legacy transit start preserves departure location', 'missing noxia_start_transit');
} else {
  requireTokens('legacy transit start preserves departure location', startTransit, [
    "set status = 'transit'::public.ship_status",
    'dest_location = p_destination_slug',
    'transit_started_at = v_departed_at',
    'arrives_at = v_arrives_at',
  ]);

  const shipUpdates = [...startTransit.matchAll(/update\s+public\.ships[\s\S]*?;/gi)].map((m) => m[0]);
  const teleport = shipUpdates.some((statement) => /\blocation\s*=/.test(statement));
  if (teleport) {
    fail('legacy transit start does not teleport location', 'start-transit writes ships.location');
  } else {
    pass('legacy transit start does not teleport location');
  }
}

// 8. Completion is the point where the legacy ship moves and transit fields are cleared.
const completeTransit = functionBlock(transit, 'noxia_complete_transit');
if (!completeTransit) {
  fail('legacy transit completion materializes destination', 'missing noxia_complete_transit');
} else {
  requireTokens('legacy transit completion materializes destination', completeTransit, [
    'set location = v_ship.dest_location',
    "status = 'docked'::public.ship_status",
    'dest_location = null',
    'arrives_at = null',
    'transit_started_at = null',
    'insert into public.ship_docking_assignments',
    'delete from public.ship_transit_pad_reservations where ship_id = v_ship.id',
  ]);
}

// 9. Canonical exact planetary coordinates remain separate from local render/cache coordinates.
requireTokens('geodetic position remains canonical', geodetic, [
  'Canonical geodetic positions for planetary world objects.',
  'latitude_deg double precision',
  'longitude_deg double precision',
  'altitude_m double precision',
  'Local x/y remain',
  'derived caches',
  'spatial_region_id is',
  'never the canonical position',
]);

// 10. The geodetic migration must not derive canonical position from location_id alone.
const suspiciousLocationOnlyDerivation = /set\s+latitude_deg[\s\S]{0,500}where\s+[^;]*location_id\s*=\s*[^;]*(?!x_m|y_m)/i;
if (suspiciousLocationOnlyDerivation.test(geodetic)) {
  // Existing backfills are permitted only when they also use local metre coordinates.
  const backfills = [...geodetic.matchAll(/update\s+public\.(?:tile_entities|player_builds)[\s\S]*?;/gi)].map((m) => m[0]);
  const invalid = backfills.filter((statement) => /set\s+latitude_deg/i.test(statement) && !/\bx_m\b/i.test(statement) && !/\by_m\b/i.test(statement));
  if (invalid.length > 0) {
    fail('exact position is not inferred from broad location alone', 'found geodetic backfill without local coordinate inputs');
  } else {
    pass('exact position is not inferred from broad location alone');
  }
} else {
  pass('exact position is not inferred from broad location alone');
}

if (failures.length > 0) {
  console.error('NOXIA Core location/node/transit invariant check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  console.error('\nIf this is an intentional architecture change, update docs/core/LOCATION_NODE_TRANSIT_STATE_MAP.md and this executable guard together.');
  process.exit(1);
}

console.log(`NOXIA Core location/node/transit invariant check passed (${passes.length} checks).`);
for (const label of passes) console.log(`- ${label}`);
