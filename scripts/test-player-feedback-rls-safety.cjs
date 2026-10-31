/** Negative-only safety tests: the local RLS harness must fail before importing
 * Supabase or connecting anywhere. Never supplies a fully valid configuration.
 */
'use strict'
const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const { join } = require('node:path')
const harness = join(__dirname, 'test-player-feedback-rls-local.cjs')
const base = {
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture-anon-not-real',
  SUPABASE_SERVICE_ROLE_KEY: 'fixture-service-not-real',
}
function rejected(label, overrides, expected) {
  const env = { PATH: process.env.PATH || '', ...base, ...overrides }
  const result = spawnSync(process.execPath, [harness], {
    env, encoding: 'utf8', timeout: 3000, maxBuffer: 65536,
  })
  assert.ifError(result.error)
  assert.notEqual(result.status, 0, label + ': harness unexpectedly accepted unsafe settings')
  assert.match(result.stderr + result.stdout, expected, label + ': wrong rejection reason')
}
rejected('missing opt-in', { NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321' }, /Explicit local-disposable opt-in required/)
rejected('remote HTTP', { NOXIA_FEEDBACK_RLS_TEST: 'local-disposable', NEXT_PUBLIC_SUPABASE_URL: 'http://supabase.example.test' }, /Refusing non-local Supabase endpoint/)
rejected('remote HTTPS', { NOXIA_FEEDBACK_RLS_TEST: 'local-disposable', NEXT_PUBLIC_SUPABASE_URL: 'https://supabase.example.test' }, /Only local HTTP Supabase is permitted/)
rejected('loopback credentials', { NOXIA_FEEDBACK_RLS_TEST: 'local-disposable', NEXT_PUBLIC_SUPABASE_URL: 'http://user:pass@localhost:54321' }, /URL credentials not allowed/)
rejected('missing keys', { NOXIA_FEEDBACK_RLS_TEST: 'local-disposable', NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321', SUPABASE_SERVICE_ROLE_KEY: '' }, /Distinct local keys required/)
rejected('same keys', { NOXIA_FEEDBACK_RLS_TEST: 'local-disposable', NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321', SUPABASE_SERVICE_ROLE_KEY: base.NEXT_PUBLIC_SUPABASE_ANON_KEY }, /Distinct local keys required/)
console.log('Local feedback RLS harness fail-closed safety checks passed (no network connections)')
