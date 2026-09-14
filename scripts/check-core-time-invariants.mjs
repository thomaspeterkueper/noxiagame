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
  const lower = content.toLowerCase();
  const start = lower.indexOf(`create or replace function public.${name.toLowerCase()}`);
  if (start < 0) return null;
  const next = lower.indexOf('create or replace function public.', start + 1);
  return content.slice(start, next < 0 ? content.length : next);
}

const baseline = read('supabase/migrations/20260719000000_baseline.sql');
const tickFoundation = read('supabase/migrations/_archive/005_tick_foundation.sql');
const resourceTick = read('supabase/migrations/20260901130000_atomic_resource_tick_updates.sql');
const eventRepair = read('supabase/migrations/20260911050000_runtime_event_stream_repair.sql');
const gameCommands = read('supabase/migrations/20260910081500_atomic_game_commands.sql');
const transitCommands = read('supabase/migrations/20260910093000_atomic_transit_commands.sql');
const marketRetry = read('supabase/migrations/20260911112830_market_command_idempotency_hardening.sql');
const coreRetry = read('supabase/migrations/20260911114600_core_command_retry_serialization.sql');
const buildCron = read('app/api/cron/builds/route.ts');

// 1. Lazy simulation tick identity is unique and separate from wall-clock timestamps.
requireTokens('tick_log owns unique simulation tick identity', baseline, [
  'CREATE TABLE IF NOT EXISTS tick_log',
  'tick_number bigint PRIMARY KEY',
  'created_at  timestamptz NOT NULL DEFAULT now()',
]);

// 2. Concurrent tick claimers are serialized and slots are persisted before execution.
const claimDueTicks = tickFoundation.match(/CREATE OR REPLACE FUNCTION claim_due_ticks[\s\S]*?END \$\$;/i)?.[0] ?? null;
if (!claimDueTicks) {
  fail('tick claiming remains serialized', 'missing claim_due_ticks');
} else {
  requireTokens('tick claiming remains serialized', claimDueTicks, [
    'PERFORM pg_advisory_xact_lock(778899)',
    'FROM tick_log',
    'INSERT INTO tick_log(tick_number, tick_type)',
    "VALUES (v_last_num + i, 'full')",
    'claimed := v_due; latest_tick := v_last_num + v_due',
  ]);
}

// 3. Wall clock decides due-ness, but does not become tick identity.
if (claimDueTicks) {
  const usesElapsedWallTime = claimDueTicks.includes('now() - v_last_at');
  const writesTimestampAsTick = /tick_number\s*\)?\s*values\s*\([^)]*(now\(\)|clock_timestamp\(\))/i.test(claimDueTicks);
  if (usesElapsedWallTime && !writesTimestampAsTick) {
    pass('wall clock gates ticks without becoming tick identity');
  } else {
    fail('wall clock gates ticks without becoming tick identity', 'tick claiming no longer cleanly separates due-time from tick identity');
  }
}

// 4. simulation_ticks is explicitly not the lazy-engine source of truth.
requireTokens('simulation_ticks remains a separate population log', tickFoundation, [
  'simulation_ticks (vom Population-Cron) bleibt bestehen',
  'tick_log ist die Quelle für die Lazy-Engine',
]);

// 5. Resource flow reuses the shared tick engine and does not add a second scheduler.
requireTokens('resource flow reuses shared tick scheduler', resourceTick, [
  'tick_log + claim_due_ticks()',
  'does not add a',
  'second scheduler or a parallel simulation ledger',
  'BEFORE UPDATE OF production, consumption',
  'COALESCE(OLD.stock, 0)',
]);

// 6. Runtime events carry optional tick context and independent operational time.
requireTokens('event tick and occurred_at remain distinct', eventRepair, [
  'tick bigint',
  'occurred_at timestamptz not null default now()',
  'create index if not exists simulation_events_tick_idx',
]);

// 7. Temporal entity history remains explicitly linked to the event that projected it.
requireTokens('entity_states remains an event-linked projection', eventRepair, [
  'source_event uuid references public.simulation_events(id) on delete set null',
  'create unique index if not exists entity_states_one_current_idx',
  'subject_type,subject_id,valid_from,properties,source_event',
  "values ('tile_entity',new.id,now(),v_properties,v_event_id)",
]);

// 8. Build event projection ignores no-op lifecycle updates.
const buildEvent = functionBlock(eventRepair, 'noxia_record_player_build_event');
if (!buildEvent) {
  fail('build event projection ignores no-op updates', 'missing noxia_record_player_build_event');
} else if (
  buildEvent.includes('new.status is not distinct from old.status') &&
  buildEvent.includes('new.completes_at is not distinct from old.completes_at') &&
  buildEvent.includes('return new;')
) {
  pass('build event projection ignores no-op updates');
} else {
  fail('build event projection ignores no-op updates', 'no-op status/completes_at guard missing');
}

// 9. Build cron discovers due work but delegates final state transition to Core command.
requireTokens('build cron delegates completion authority', buildCron, [
  ".eq('status', 'building')",
  ".lte('completes_at', new Date().toISOString())",
  'completeBuildCommand(build.id, !buildable.planned)',
]);
if (/\.update\s*\(/i.test(buildCron) || /\.insert\s*\(/i.test(buildCron)) {
  fail('build cron does not mutate final gameplay state directly', 'cron contains direct update/insert mutation');
} else {
  pass('build cron does not mutate final gameplay state directly');
}

// 10. Build and sale completion serialize on domain rows and return idempotent results.
const completeBuild = functionBlock(gameCommands, 'noxia_complete_build');
if (!completeBuild) {
  fail('build completion remains row-locked and idempotent', 'missing noxia_complete_build');
} else {
  requireTokens('build completion remains row-locked and idempotent', completeBuild, [
    'for update',
    "if v_build.status = 'complete' then",
    "'idempotent', true",
    'on conflict (source_build_id) where source_build_id is not null do nothing',
  ]);
}

const completeSale = functionBlock(gameCommands, 'noxia_complete_sale');
if (!completeSale) {
  fail('sale completion remains row-locked and idempotent', 'missing noxia_complete_sale');
} else {
  requireTokens('sale completion remains row-locked and idempotent', completeSale, [
    'for update',
    "if v_build.status = 'sold' then",
    "'idempotent', true",
  ]);
}

// 11. Transit retries do not re-charge departure or re-apply arrival effects.
const startTransit = functionBlock(transitCommands, 'noxia_start_transit');
const completeTransit = functionBlock(transitCommands, 'noxia_complete_transit');
if (!startTransit || !completeTransit) {
  fail('transit transitions remain retry-safe', 'missing start/complete transit function');
} else {
  requireTokens('transit transitions remain retry-safe', startTransit + completeTransit, [
    "if v_ship.status = 'transit'::public.ship_status then",
    "'idempotent', true",
    "if v_ship.status <> 'transit'::public.ship_status then",
  ]);
}

// 12. Marketplace command identity is explicit, serialized, replayable and payload-safe.
requireTokens('market commands remain command-id serialized', marketRetry, [
  "pg_advisory_xact_lock(hashtextextended('noxia_market_offer:' || p_command_id::text, 0))",
  "pg_advisory_xact_lock(hashtextextended('noxia_market_buy:' || p_command_id::text, 0))",
  'where command_id = p_command_id',
  "'idempotent', true",
]);
requireTokens('market command-id reuse with different payload conflicts', marketRetry, [
  'NOXIA_MARKET_OFFER_COMMAND_CONFLICT',
  'NOXIA_MARKET_BUY_COMMAND_CONFLICT',
]);

// 13. Shared logistics/docking/itinerary commands serialize simultaneous retries by command UUID.
const retryLockCount = [...coreRetry.matchAll(/pg_advisory_xact_lock\(hashtextextended\('noxia_[^']+:' \|\| p_command_id::text, 0\)\)/g)].length;
if (retryLockCount >= 7) {
  pass('shared Core commands serialize concurrent retries');
} else {
  fail('shared Core commands serialize concurrent retries', `expected >=7 command locks, found ${retryLockCount}`);
}

// 14. Retry identity must remain command/tick/state based, never event timestamp based.
const suspiciousTimestampCommandLookup = /where\s+(created_at|updated_at|occurred_at)\s*=\s*p_command_id/i.test(
  marketRetry + coreRetry + gameCommands + transitCommands,
);
if (suspiciousTimestampCommandLookup) {
  fail('timestamps are not used as retry identity', 'found timestamp field used as command-id lookup');
} else {
  pass('timestamps are not used as retry identity');
}

if (failures.length > 0) {
  console.error('NOXIA Core time/tick/event/replay invariant check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  console.error('\nIf this is an intentional architecture change, update docs/core/TIME_TICK_EVENT_REPLAY_MAP.md and this executable guard together.');
  process.exit(1);
}

console.log(`NOXIA Core time/tick/event/replay invariant check passed (${passes.length} checks).`);
for (const label of passes) console.log(`- ${label}`);
