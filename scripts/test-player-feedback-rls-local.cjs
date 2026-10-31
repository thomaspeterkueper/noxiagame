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
  const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  const service = createClient(rawUrl, serviceKey, options)
  const anon = createClient(rawUrl, anonKey, options)
  const ids = []
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
        global: { headers: { Authorization: 'Bearer ' + data.session.access_token } },
      })
    }
    const [clientA, clientB] = await Promise.all([login(a), login(b)])
    const { data: inserted, error: insertError } = await service.from('player_feedback_submissions')
      .insert([receiptRow(a.id), receiptRow(b.id)])
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
      await expectDenied(client.from('player_feedback_submissions')
        .update({ status: 'accepted_for_planning' }).eq('id', ownId),
        label + ' unauthorized moderation')
      await expectDenied(client.from('player_feedback_submissions')
        .insert(receiptRow(label === 'A' ? b.id : a.id)),
        label + ' owner-spoofed insert')
    }
    await expectDenied(anon.from('player_feedback_submissions').select('id'),
      'anonymous receipt read')
    console.log('LOCAL feedback two-user RLS isolation passed; no world/Core writes')
  } finally {
    // Always clean up, even on assertion failure. Local disposable DB ONLY.
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
