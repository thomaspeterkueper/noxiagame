// #615 / PR #627: read-only database preflight is safe to inspect and rerun.
// Run: node --test scripts/buildCancelDatabasePreflight.test.mjs
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const sql = readFileSync(new URL('./buildCancelDatabasePreflight.sql', import.meta.url), 'utf8')
const executable = sql.replace(/--[^\n]*/g, '').trim()

test('preflight is one read-only query and does not disclose player/build rows', () => {
  assert.match(executable, /^with\s+cancellation\s+as\s*\(/i)
  assert.match(executable, /select\s+checks\.\*/i)
  assert.doesNotMatch(executable, /\b(?:insert|update|delete|alter|drop|create|truncate|grant|revoke|do|call|copy|execute)\b\s+(?:into|from|table|function|on|public|\$|\()/i)
  assert.doesNotMatch(executable, /\bfrom\s+public\.(?:profiles|player_builds|tile_entities)\b/i)
  assert.doesNotMatch(executable, /\b(?:profile_id|build_id|username|email)\s+as\s+/i)
})

test('preflight checks schema, RPC ownership/locking, and least privilege', () => {
  for (const name of [
    'refund_snapshot_column_present', 'refund_constraint_validated',
    'cancel_rpc_security_definer', 'cancel_rpc_has_row_lock',
    'cancel_rpc_has_ownership_guard', 'cancel_rpc_rejects_unknown_refund',
    'start_rpc_persists_refund_snapshot', 'anon_can_execute_cancel',
    'authenticated_can_execute_cancel', 'service_role_can_execute_cancel',
    'ready_for_integration',
  ]) assert.match(executable, new RegExp(`\\b${name}\\b`))
  assert.match(executable, /not anon_can_execute_cancel and not authenticated_can_execute_cancel/i)
  assert.match(executable, /service_role_can_execute_cancel\) as ready_for_integration/i)
})
