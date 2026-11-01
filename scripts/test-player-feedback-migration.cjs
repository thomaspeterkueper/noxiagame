// Static safety smoke test only. Actual SQL execution/RLS isolation must be
// verified separately in an isolated Supabase test database.
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')

const migration = readFileSync(join(__dirname, '../supabase/migrations/20261031080000_player_feedback_submissions.sql'), 'utf8')
const sqlTest = readFileSync(join(__dirname, '../supabase/tests/player_feedback_submissions.test.sql'), 'utf8')

for (const [name, pattern] of Object.entries({
  authOwner: /owner_user_id\s+uuid\s+not\s+null\s+references\s+auth\.users\(id\)/i,
  enabledRls: /alter\s+table\s+public\.player_feedback_submissions\s+enable\s+row\s+level\s+security/i,
  ownerSelect: /create\s+policy\s+player_feedback_owner_receipts_select[\s\S]*?for\s+select\s+to\s+authenticated[\s\S]*?owner_user_id\s*=\s*\(select\s+auth\.uid\(\)\)/i,
  limitedColumns: /grant\s+select\s*\(id,\s*title,\s*status,\s*created_at\)\s+on\s+table\s+public\.player_feedback_submissions\s+to\s+authenticated/i,
  serviceRole: /grant\s+select,\s*insert,\s*update,\s*delete\s+on\s+table\s+public\.player_feedback_submissions\s+to\s+service_role/i,
  ownerKeyUnique: /constraint\s+player_feedback_owner_idempotency_unique\s+unique\s*\(owner_user_id,\s*idempotency_key\)/i,
  consent: /constraint\s+player_feedback_public_requires_consent/i,
  provenance: /constraint\s+player_feedback_source_ref_consistency/i,
  conversationSourceNonNull: /\(source_kind\s*=\s*'conversation'\s+and\s+private_source_ref\s+is\s+not\s+null\s+and\s+private_source_ref\s*~/i,
  noWorldActions: /no\s+automatic\s+civic\s+authority\s+or\s+Core\/world\s+mutations/i,
})) {
  assert.match(migration, pattern, `missing migration safety invariant: ${name}`)
}

assert.doesNotMatch(migration, /^\s*grant\s+(?:all|insert|update|delete)(?:\s|,)[^;]*to\s+(?:authenticated|anon)\s*;/gim,
  'client must not receive mutation grants')
assert.match(sqlTest, /NOXIA_FEEDBACK_PRIVATE_COLUMN_EXPOSED/, 'SQL test must check private columns')
assert.match(sqlTest, /NOXIA_FEEDBACK_CLIENT_WRITE_OR_ANON_READ_GRANT/, 'SQL test must check client grants')
assert.match(sqlTest, /NOXIA_FEEDBACK_CONVERSATION_SOURCE_NONNULL_MISSING/, 'SQL test must check null conversation provenance')
console.log('Feedback migration static contract passed (SQL/RLS execution not performed)')
