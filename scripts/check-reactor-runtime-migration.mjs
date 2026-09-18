import fs from 'node:fs'
import path from 'node:path'

const migrationPath = path.join(
  process.cwd(),
  'supabase/migrations/20260918114000_reactor_runtime_e2a.sql',
)
const sql = fs.readFileSync(migrationPath, 'utf8')

function requireText(text, message) {
  if (!sql.includes(text)) throw new Error(message)
}

function forbid(pattern, message) {
  if (pattern.test(sql)) throw new Error(message)
}

requireText('create or replace function public.noxia_set_reactor_runtime', 'E2a must expose the canonical reactor runtime command')
requireText('security definer', 'reactor runtime command must remain a server-owned SECURITY DEFINER boundary')
requireText('set search_path = public', 'reactor runtime command must pin search_path')
requireText("'reactor.runtime.changed'", 'E2a must append the canonical reactor runtime event')
requireText("'reactor_runtime'", 'E2a must project into the dedicated reactor_runtime subject domain')
requireText('pg_advisory_xact_lock', 'E2a command must serialize idempotency and per-reactor writes')
requireText('canonical_event_id', 'E2a command must persist stable replay identity')
requireText('effect_group_id', 'E2a command must preserve command/effect grouping')
requireText('grant execute on function public.noxia_set_reactor_runtime', 'E2a must explicitly grant its command')
requireText('to service_role', 'E2a command must be service-role only')
requireText('from anon', 'E2a must revoke anonymous execution')
requireText('from authenticated', 'E2a must revoke direct authenticated execution')

forbid(/\bcreate\s+table\b/i, 'E2a must not create a second reactor-state table')
forbid(/\bupdate\s+public\.tile_entities\b/i, 'E2a runtime command must not mutate physical tile entity identity/state')
forbid(/\binsert\s+into\s+public\.tile_entities\b/i, 'E2a runtime command must not create physical reactor assets')
forbid(/nominalPowerMw/, 'E2a runtime persistence must not duplicate nominal engineering MW')
forbid(/availablePowerMw/, 'E2a runtime persistence must not store derived available MW')

console.log('reactor runtime E2a migration guard passed')
