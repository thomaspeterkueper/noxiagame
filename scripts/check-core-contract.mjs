import { readFileSync } from 'node:fs';

const checks = [
  {
    file: 'supabase/migrations/20260911060537_logistics_core_inventories_and_transport_jobs.sql',
    mustContain: [
      'Core owns authoritative stock/reservation/job mutation',
      'create table if not exists public.logistics_inventories',
      'create table if not exists public.logistics_reservations',
      'create table if not exists public.transport_jobs',
      "unique index if not exists transport_jobs_active_vehicle_uidx",
      "array['reserved','loading','in_transit','arrived','unloading']",
    ],
  },
  {
    file: 'supabase/migrations/20260911063018_vehicle_instance_core.sql',
    mustContain: [
      'create table if not exists public.vehicle_instances',
      'owner_profile_id uuid references public.profiles',
      'current_node_inventory_id uuid references public.logistics_inventories',
      "storage_kind='native' and subject_type='vehicle_instance'",
      "new.status='in_transit'",
      'set status=\'in_transit\',current_node_inventory_id=null',
    ],
  },
  {
    file: 'supabase/migrations/20260911111420_custody_marketplace_core.sql',
    mustContain: [
      'create table if not exists public.storage_accounts',
      'host_inventory_id uuid not null references public.logistics_inventories',
      'owner_profile_id uuid not null references public.profiles',
      'Market offers never create a second stock pool',
      "subject_type = 'storage_account'",
    ],
  },
  {
    file: 'supabase/migrations/20260910081500_atomic_game_commands.sql',
    mustContain: ['set search_path to public'],
  },
  {
    file: 'supabase/migrations/20260910083000_atomic_trade_commands.sql',
    mustContain: ['set search_path to public'],
  },
  {
    file: 'supabase/migrations/20260910090000_atomic_finance_asset_commands.sql',
    mustContain: ['set search_path to public'],
  },
  {
    file: 'supabase/migrations/20260910093000_atomic_transit_commands.sql',
    mustContain: ['set search_path to public'],
  },
  {
    file: 'supabase/migrations/20260831195000_runtime_canon_projection_boundary.sql',
    mustContain: ['runtime', 'canon'],
  },
  {
    file: 'supabase/migrations/20260909180000_global_geodetic_world_positions.sql',
    mustContain: ['world'],
  },
];

const failures = [];

for (const check of checks) {
  let content;
  try {
    content = readFileSync(check.file, 'utf8');
  } catch (error) {
    failures.push(`${check.file}: missing/unreadable (${error.message})`);
    continue;
  }

  for (const token of check.mustContain) {
    if (!content.includes(token)) {
      failures.push(`${check.file}: missing contract token: ${JSON.stringify(token)}`);
    }
  }
}

if (failures.length > 0) {
  console.error('NOXIA Core contract check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  console.error('\nIf the architecture changed intentionally, update docs/core/CORE_CONTRACT.md and this guard in the same PR.');
  process.exit(1);
}

console.log(`NOXIA Core contract check passed (${checks.length} authoritative migration contracts).`);
