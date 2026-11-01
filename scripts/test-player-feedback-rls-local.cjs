/**
 * Disposable LOCAL Supabase integration test, never run in production or normal CI.
 * Prerequisite: apply the reviewed feedback migration to a throwaway local instance.
 * Run only with NOXIA_FEEDBACK_RLS_TEST=local-disposable and local Supabase URL,
 * anon key and service-role key. Creates two temporary auth users and deletes them.
 * No world/Core tables are touched.
 */
'use strict'
const assert = require('node:assert/strict')
const { randomUUID, randomBytes, createHash } = require('node:crypto')

async function main() {
  assert.equal(process.env.NOXIA_FEEDBACK_RLS_TEST, 'local-disposable',
    'Explicit local-disposable opt-in required')
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  assert.ok(rawUrl, 'NEXT_PUBLIC_SUPABASE_URL required')
  const url = new URL(rawUrl)
  assert.equal(url.protocol, 'http:', 'Only local HTTP Supabase is permitted')
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname),
    'Refusing non-local Supabase endpoint')
  assert.ok(!url.username && !url.password, 'URL credentials not allowed')
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  assert.ok(anonKey && serviceKey && anonKey !== serviceKey, 'Distinct local keys required')
  // Import after the safety gate: even module initialization must not touch remote services.
  const { createClient } = require('@supabase/supabase-js')
  const { createLocalOnlyFetch } = require('./feedback-local-only-fetch.cjs')
  const localOnlyFetch = createLocalOnlyFetch(url.origin)
  const options = {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: localOnlyFetch },
  }
  const service = createClient(rawUrl, serviceKey, options)
  const anon = createClient(rawUrl, anonKey, options)
  const ids = []
  const conversationIds = []
  const marker = randomUUID().slice(0, 8)
  const password = randomBytes(24).toString('hex')
  const createUser = async suffix => {
    const { data, error } = await service.auth.admin.createUser({
      email: `noxia-feedback-rls-${marker}-${suffix}@example.test`,
      password, email_confirm: true,
    })
    if (error || !data?.user?.id) throw Error('Local fixture user creation failed: ' + (error?.code ?? 'unknown'))
    ids.push(data.user.id)
    return { id: data.user.id, email: data.user.email }
  }
  const receiptRow = ownerId => ({
    owner_user_id: ownerId,
    destination: 'development',
    category: 'idea',
    title: 'Isolierter Feedbacktest',
    description: 'Nur ein Testeintrag in einer lokalen Wegwerfdatenbank.',
    requested_visibility: 'private',
    publication_consent: false,
    source_kind: 'direct',
    private_source_ref: null,
    status: 'submitted_for_review',
    idempotency_key: 'rls-' + randomUUID(),
    payload_fingerprint: createHash('sha256').update(randomUUID()).digest('hex'),
  })
  const expectDenied = async (promise, label) => {
    const { error } = await promise
    assert.ok(error, label + ' must be denied')
  }
  try {
    const a = await createUser('a')
    const b = await createUser('b')
    const login = async user => {
      const loginClient = createClient(rawUrl, anonKey, options)
      const { data, error } = await loginClient.auth.signInWithPassword({ email: user.email, password })
      if (error || !data?.session?.access_token) throw Error('Local fixture login failed: ' + (error?.code ?? 'unknown'))
      return createClient(rawUrl, anonKey, {
        ...options,
        global: { fetch: localOnlyFetch, headers: { Authorization: 'Bearer ' + data.session.access_token } },
      })
    }
    const [clientA, clientB] = await Promise.all([login(a), login(b)])
    // Real conversation rows, tied to auth.users by the deployed schema FK.
    // Only fixture text is inserted; no production transcript is read.
    for (const owner of [a, b]) {
      const { data, error } = await service.from('npc_conversation_log').insert({
        player_profile_id: owner.id,
        npc_key: 'feedback-local-test',
        player_text: 'Disposable local conversation ownership test',
        outcome: 'reply',
      }).select('id,player_profile_id').single()
      if (error || !data?.id) throw Error('Local conversation fixture failed: ' + (error?.code ?? 'unknown'))
      conversationIds.push(String(data.id))
      assert.equal(data.player_profile_id, owner.id, 'Conversation owner must be auth user UUID')
    }
    // Invoke the same server-side provenance verifier used by feedback POST.
    // Compile the exact TypeScript production verifier with the project's TypeScript
    // dependency; do not rely on version-specific Node native TS loading.
    const fs = require('node:fs')
    const Module = require('node:module')
    const path = require('node:path')
    const ts = require('typescript')
    const verifierPath = path.resolve(__dirname, '../lib/game/evolution/conversationSourceOwnership.server.ts')
    const compiled = ts.transpileModule(fs.readFileSync(verifierPath, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
      fileName: verifierPath,
      reportDiagnostics: true,
    })
    assert.equal(compiled.diagnostics?.length ?? 0, 0, 'Verifier TS transpilation must succeed')
    const verifierModule = new Module(verifierPath, module)
    verifierModule.filename = verifierPath
    verifierModule.paths = module.paths
    verifierModule._compile(compiled.outputText, verifierPath)
    const { verifyConversationSourceOwnership } = verifierModule.exports
    for (let i = 0; i < 2; i++) {
      const checkedOwn = await verifyConversationSourceOwnership(
        'npc_conversation_log:' + conversationIds[i], ids[i], service)
      assert.equal(checkedOwn.ok, true, 'Owner verifier must accept own conversation')
      const checkedForeign = await verifyConversationSourceOwnership(
        'npc_conversation_log:' + conversationIds[1-i], ids[i], service)
      assert.deepEqual(checkedForeign,
        { ok: false, error: 'conversation_source_unavailable' },
        'Owner verifier must reject foreign conversation without disclosing existence')
      const own = await service.from('npc_conversation_log')
        .select('id,player_profile_id').eq('id', conversationIds[i]).eq('player_profile_id', ids[i]).maybeSingle()
      assert.ifError(own.error)
      assert.equal(String(own.data?.id), conversationIds[i], 'Own conversation must be discoverable')
      const foreign = await service.from('npc_conversation_log')
        .select('id,player_profile_id').eq('id', conversationIds[1-i]).eq('player_profile_id', ids[i]).maybeSingle()
      assert.ifError(foreign.error)
      assert.equal(foreign.data, null, 'Foreign conversation must not pass owner-scoped lookup')
    }
    const fixtureA = receiptRow(a.id)
    const fixtureB = receiptRow(b.id)
    const { data: inserted, error: insertError } = await service.from('player_feedback_submissions')
      .insert([fixtureA, fixtureB])
      .select('id,owner_user_id')
    if (insertError) throw Error('Local fixture insert failed: ' + (insertError.code ?? 'unknown'))
    assert.equal(inserted?.length, 2, 'Two fixture rows required')
    const idA = inserted.find(row => row.owner_user_id === a.id)?.id
    const idB = inserted.find(row => row.owner_user_id === b.id)?.id
    assert.ok(idA && idB, 'Both fixture receipts must exist')

    for (const [client, ownId, foreignId, label] of [
      [clientA, idA, idB, 'A'], [clientB, idB, idA, 'B'],
    ]) {
      const { data, error } = await client.from('player_feedback_submissions')
        .select('id,title,status,created_at')
      assert.ifError(error)
      assert.ok(data?.some(row => row.id === ownId), label + ' must read own receipt')
      assert.ok(!data?.some(row => row.id === foreignId), label + ' must not read other receipt')
      await expectDenied(client.from('player_feedback_submissions').select('description'),
        label + ' private description')
      await expectDenied(client.from('player_feedback_submissions').select('owner_user_id'),
        label + ' private owner id')
      await expectDenied(client.from('player_feedback_submissions').select('private_source_ref'),
        label + ' private provenance')
      const { data: foreign, error: foreignError } = await client.from('player_feedback_submissions')
        .select('id').eq('id', foreignId)
      assert.ifError(foreignError)
      assert.equal(foreign?.length, 0, label + ' foreign-id lookup must be empty')
      // RLS must deny *all* direct player writes, including writes to the
      // player's own rows. Ownership grants receipt reads, never mutation.
      await expectDenied(client.from('player_feedback_submissions')
        .insert(receiptRow(label === 'A' ? a.id : b.id)),
        label + ' self-owned client insert')
      await expectDenied(client.from('player_feedback_submissions')
        .update({ status: 'accepted_for_planning' }).eq('id', ownId),
        label + ' unauthorized moderation')
      await expectDenied(client.from('player_feedback_submissions')
        .delete().eq('id', ownId),
        label + ' self-owned client delete')
      await expectDenied(client.from('player_feedback_submissions')
        .insert(receiptRow(label === 'A' ? b.id : a.id)),
        label + ' owner-spoofed insert')
    }
    // A denied write must also leave the original receipts intact. This
    // catches silent zero-row RLS operations or unexpected side effects.
    const { data: retained, error: retainedError } = await service
      .from('player_feedback_submissions')
      .select('id,owner_user_id,status').in('id', [idA, idB])
    assert.ifError(retainedError)
    assert.equal(retained?.length, 2, 'Both receipts must survive denied writes')
    for (const [receiptId, ownerId] of [[idA, a.id], [idB, b.id]]) {
      const row = retained.find(entry => entry.id === receiptId)
      assert.equal(row?.owner_user_id, ownerId, 'Receipt owner must remain unchanged')
      assert.equal(row?.status, 'submitted_for_review',
        'Denied client moderation must not change receipt status')
    }

    // Five concurrent NEW submissions for A after its first fixture row: the
    // database advisory lock must allow exactly four and reject the fifth.
    // This tests the trigger against actual parallel HTTP inserts, not a mock.
    const burst = await Promise.all(Array.from({ length: 5 }, () =>
      service.from('player_feedback_submissions').insert(receiptRow(a.id))))
    const accepted = burst.filter(result => !result.error)
    const rejected = burst.filter(result => result.error)
    assert.equal(accepted.length, 4, 'Only four further A submissions may succeed')
    assert.equal(rejected.length, 1, 'Exactly one concurrent submission must be rate limited')
    assert.equal(rejected[0].error.code, 'P0001', 'Rate rejection must use SQLSTATE P0001')
    assert.match(rejected[0].error.message, /feedback_rate_limit_exceeded/,
      'Rate rejection must identify the expected trigger')

    const { count, error: countError } = await service.from('player_feedback_submissions')
      .select('id', { count: 'exact', head: true }).eq('owner_user_id', a.id)
    assert.ifError(countError)
    assert.equal(count, 5, 'A must have exactly five rows after the burst')

    // A duplicate key is a uniqueness conflict even at the rate cap; the API
    // (not this database harness) is responsible for returning the original
    // receipt on identical retries and 409 for conflicting payloads.
    const duplicate = await service.from('player_feedback_submissions').insert(fixtureA)
    assert.equal(duplicate.error?.code, '23505', 'Same-key retry must hit uniqueness')
    const conflicting = await service.from('player_feedback_submissions')
      .insert({ ...fixtureA, title: 'Andere Testüberschrift',
        payload_fingerprint: 'b'.repeat(64) })
    assert.equal(conflicting.error?.code, '23505',
      'Same key with different content must hit uniqueness')
    const otherOwner = await service.from('player_feedback_submissions').insert(receiptRow(b.id))
    assert.ifError(otherOwner.error) // A's rate limit must not throttle B.

    await expectDenied(anon.from('player_feedback_submissions').select('id'),
      'anonymous receipt read')
    console.log('LOCAL feedback two-user RLS and concurrent rate-limit checks passed; no world/Core writes')
  } finally {
    // Always clean up, even on assertion failure. Local disposable DB ONLY.
    if (conversationIds.length) {
      const { error } = await service.from('npc_conversation_log').delete().in('id', conversationIds)
      if (error) { console.error('Local conversation cleanup failed:', error.code); process.exitCode = 1 }
    }
    if (ids.length) {
      const { error } = await service.from('player_feedback_submissions')
        .delete().in('owner_user_id', ids)
      if (error) { console.error('Local fixture row cleanup failed:', error.code); process.exitCode = 1 }
    }
    for (const id of ids) {
      const { error } = await service.auth.admin.deleteUser(id)
      if (error) { console.error('Local fixture user cleanup failed:', error.code); process.exitCode = 1 }
    }
  }
}
main().catch(error => { console.error('LOCAL feedback RLS test failed:', error.message); process.exitCode = 1 })
