// Regression contract for issue #615. Expected RED until cancellation is atomic.
// Run: node --test scripts/buildCancelAtomicContract.test.mjs
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const route = readFileSync(new URL('../app/api/game/build/route.ts', import.meta.url), 'utf8')
const commands = readFileSync(new URL('../lib/game/core/commands.ts', import.meta.url), 'utf8')

test('cancellation delegates to an atomic Core command', () => {
  assert.match(commands, /export async function cancelBuildCommand\s*\(/)
  assert.match(commands, /\.rpc\(['"]noxia_cancel_build['"]/)
  const cancel = route.match(/if \(action === 'cancel'\) \{([\s\S]*?)\n  \}\n\n  if \(action === 'sellQuote'\)/)?.[1]
  assert.ok(cancel, 'cancel route must remain discoverable until migration')
  assert.match(cancel, /await cancelBuildCommand\(/)
  assert.doesNotMatch(cancel, /\.from\(['"](?:profiles|player_builds)['"]\)\.(?:update|insert|delete)\(/)
})

test('cancellation never calculates refunds from mutable client-side prices', () => {
  const cancel = route.match(/if \(action === 'cancel'\) \{([\s\S]*?)\n  \}\n\n  if \(action === 'sellQuote'\)/)?.[1]
  assert.ok(cancel)
  assert.doesNotMatch(cancel, /defForCancel|localBuildingDef|Math\.floor/)
})

// Guard against introducing a cancellation RPC that silently trusts mutable
// building definitions or permits repeated payouts. This test remains RED until
// the migration is committed and verified against a disposable database.
test('cancellation SQL locks the build and fails closed without a refund snapshot', () => {
  const migration = readFileSync(new URL('../supabase/migrations/20261107001000_atomic_build_cancel.sql', import.meta.url), 'utf8')
  assert.match(migration, /create or replace function public\.noxia_cancel_build\s*\(/i)
  assert.match(migration, /for update/i)
  assert.match(migration, /profile_id\s+is\s+distinct\s+from\s+p_profile_id/i)
  assert.match(migration, /refund_credits_snapshot\s+is\s+null/i)
  assert.match(migration, /status\s*=\s*'cancelled'/i)
  assert.match(migration, /grant execute on function public\.noxia_cancel_build\(uuid,uuid\) to service_role/i)
})


test('cancellation rejects non-building targets and negative refund snapshots', () => {
  const migration = readFileSync(new URL('../supabase/migrations/20261107001000_atomic_build_cancel.sql', import.meta.url), 'utf8')
  assert.match(migration, /target_type\s+is\s+distinct\s+from\s+'building'/i)
  assert.match(migration, /check\s*\(refund_credits_snapshot\s+is\s+null\s+or\s+refund_credits_snapshot\s*>=\s*0\)/i)
})

test('refund snapshot constraint is guarded for repeatable draft migrations', () => {
  const migration = readFileSync(new URL('../supabase/migrations/20261107001000_atomic_build_cancel.sql', import.meta.url), 'utf8')
  assert.match(migration, /if not exists\s*\(\s*select 1 from pg_constraint/i)
  assert.match(migration, /conrelid\s*=\s*'public\.player_builds'::regclass/i)
  assert.match(migration, /conname\s*=\s*'player_builds_refund_snapshot_nonnegative'/i)
})
