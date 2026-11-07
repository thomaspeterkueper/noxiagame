/** No-network unit checks for the disposable Supabase harness transport. */
'use strict'
const assert = require('node:assert/strict')
const { createLocalOnlyFetch } = require('./feedback-local-only-fetch.cjs')

async function main() {
  let calls = 0
  const transport = createLocalOnlyFetch('http://127.0.0.1:54321', async (_input, init) => {
    calls++
    assert.equal(init.redirect, 'manual', 'redirects must never auto-follow')
    return { status: 200 }
  })
  assert.equal((await transport('http://127.0.0.1:54321/rest/v1/player_feedback_submissions')).status, 200)
  assert.equal(calls, 1)
  for (const address of [
    'https://127.0.0.1:54321/rest/v1',
    'http://127.0.0.1:54322/rest/v1',
    'http://localhost:54321/rest/v1',
    'http://example.test/rest/v1',
    'http://user:password@127.0.0.1:54321/rest/v1',
  ]) {
    await assert.rejects(transport(address), /Refusing non-local or different-origin/)
  }
  assert.equal(calls, 1, 'rejected requests must not reach delegate')
  await assert.rejects(transport('not-a-url'), /Invalid local feedback request URL/)
  assert.throws(() => createLocalOnlyFetch('https://127.0.0.1:54321'), /exact loopback HTTP origin/)
  assert.throws(() => createLocalOnlyFetch('http://example.test'), /exact loopback HTTP origin/)
  const redirecting = createLocalOnlyFetch('http://127.0.0.1:54321', async () => ({ status: 302 }))
  await assert.rejects(redirecting('http://127.0.0.1:54321/auth/v1/token'), /Refusing redirect/)
  console.log('Local feedback transport origin and redirect guards passed (no network)')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
