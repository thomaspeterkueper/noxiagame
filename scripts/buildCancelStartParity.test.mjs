// Issue #615 / PR #627: prevent draft cancellation migration from silently
// replacing unrelated start-build behavior when the base RPC evolves.
// Run: node --test scripts/buildCancelStartParity.test.mjs
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const baseline = readFileSync(new URL('../supabase/migrations/20260910081500_atomic_game_commands.sql', import.meta.url), 'utf8')
const draft = readFileSync(new URL('../supabase/migrations/20261107001000_atomic_build_cancel.sql', import.meta.url), 'utf8')

function startBuildDefinition(sql) {
  const match = sql.match(/create or replace function public\.noxia_start_build\([\s\S]*?\n\$\$;/i)
  assert.ok(match, 'noxia_start_build definition must be present')
  return match[0]
}

function withoutExpectedSnapshotDelta(sql) {
  return sql
    .replace(/--[^\n]*/g, '')
    .replace(/if p_cost_credits is null or p_cost_credits < 0 then/i, 'if p_cost_credits < 0 then')
    .replace(/,\s*refund_credits_snapshot/g, '')
    .replace(/,\s*p_cost_credits\s*\/\s*2/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

test('draft start-build RPC preserves the original contract except for refund snapshot and null guard', () => {
  const original = startBuildDefinition(baseline)
  const replacement = startBuildDefinition(draft)
  assert.match(replacement, /if p_cost_credits is null or p_cost_credits < 0 then/i)
  assert.match(replacement, /refund_credits_snapshot/)
  assert.match(replacement, /p_cost_credits\s*\/\s*2/)
  assert.equal(withoutExpectedSnapshotDelta(replacement), withoutExpectedSnapshotDelta(original),
    'Unexpected RPC drift: reconcile the draft migration with the authoritative base before merge')
})
