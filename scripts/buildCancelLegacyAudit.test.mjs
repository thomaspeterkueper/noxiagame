// Run: node --test scripts/buildCancelLegacyAudit.test.mjs
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const sql = readFileSync(new URL('./buildCancelLegacyAudit.sql', import.meta.url), 'utf8')
const statements = sql.replace(/--[^\n]*/g, '')

test('legacy build audit is read-only and never infers historical prices', () => {
  assert.match(statements, /select exists\s*\(/i)
  assert.match(statements, /information_schema\.columns/i)
  assert.match(statements, /to_jsonb\(b\)->>'refund_credits_snapshot'/i)
  assert.match(statements, /missing_refund_snapshots/i)
  assert.match(statements, /group by b\.target_type, b\.status, b\.buildable_id/i)
  assert.doesNotMatch(statements, /\b(?:insert|update|delete|alter|drop|truncate|grant|revoke|create|call|do)\b/i)
  assert.doesNotMatch(statements, /building_definitions|\bprofiles\b/i)
})

test('legacy build audit cannot expose player or build identifiers', () => {
  assert.doesNotMatch(statements, /b\.profile_id|b\.id\b|select\s+\*/i)
  assert.match(statements, /count\(\*\)/i)
})

test('legacy audit counts active cancellation blockers and invalid snapshots separately', () => {
  assert.match(statements, /as invalid_refund_snapshots/i)
  assert.match(statements, /as cancellation_blockers/i)
  assert.match(statements, /where b\.status = 'building'/i)
  assert.ok(statements.includes("!~ '^[0-9]+$'"), 'non-numeric or negative snapshots must be flagged')
  assert.match(statements, /refund_credits_snapshot' is null/i)
})
