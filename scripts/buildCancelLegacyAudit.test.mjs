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
