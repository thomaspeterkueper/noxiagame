import { verifyConversationSourceOwnership as verify, type ConversationLogReader } from './conversationSourceOwnership.server'

const assert = (ok: boolean, message: string) => { if (!ok) throw Error(message) }
const ownerA = '11111111-1111-4111-8111-111111111111'
const ownerB = '22222222-2222-4222-8222-222222222222'
const source = 'npc_conversation_log:42'
const calls: string[] = []
const reader = (row: unknown, error: unknown = null): ConversationLogReader => ({
  from(table) {
    calls.push('from:' + table)
    return {
      select(columns) {
        calls.push('select:' + columns)
        const query = {
          eq(column: string, value: string) { calls.push(column + ':' + value); return query },
          async maybeSingle() { calls.push('maybeSingle'); return { data: row as { id: unknown; player_profile_id: unknown } | null, error } },
        }
        return query
      },
    }
  },
})

async function main() {
  const own = await verify(source, ownerA, reader({ id: 42, player_profile_id: ownerA, player_text: 'PRIVATE' }))
  assert(own.ok && own.ownerVerified && own.privateSourceRef === source, 'verified owner accepted')
  assert(JSON.stringify(own).indexOf('PRIVATE') === -1, 'no private transcript returned')
  assert(calls.join('|') === 'from:npc_conversation_log|select:id,player_profile_id|id:42|player_profile_id:' + ownerA + '|maybeSingle',
    'service-role lookup is constrained to both source ID and authenticated owner')
  for (const [row, err] of [
    [{ id: 42, player_profile_id: ownerB }, null],
    [null, null],
    [{ id: 43, player_profile_id: ownerA }, null],
    [{ id: 42, player_profile_id: ownerA }, { code: 'PGRST116' }],
    [{ id: Number.MAX_SAFE_INTEGER + 1, player_profile_id: ownerA }, null],
  ] as const) {
    const result = await verify(source, ownerA, reader(row, err))
    assert('error' in result && result.error === 'conversation_source_unavailable', 'foreign/missing/ambiguous/error fail closed')
  }
  const largeRef = 'npc_conversation_log:9007199254740993'
  const precise = await verify(largeRef, ownerA, reader({ id: '9007199254740993', player_profile_id: ownerA }))
  assert(precise.ok, 'bigint string receipt remains valid without numeric rounding')
  const rounded = await verify(largeRef, ownerA, reader({ id: 9007199254740993, player_profile_id: ownerA }))
  assert('error' in rounded && rounded.error === 'conversation_source_unavailable', 'unsafe JS number fails closed')
  const failure = await verify(source, ownerA, {
    from() { throw Error('private database exception') },
  })
  assert('error' in failure && failure.error === 'conversation_source_unavailable', 'no database error leakage')
  for (const bad of [null, '', 'npc_conversation_log:0', 'npc_conversation_log:042',
    'npc_conversation_log:42?owner=' + ownerA, 'npc_conversation_log:9223372036854775808',
    'npc_conversation_log:12345678901234567890', 'vote:42', 'npc_conversation_log:42\n']) {
    const before = calls.length
    const result = await verify(bad, ownerA, reader(null))
    assert('error' in result && result.error === 'invalid_source_ref', 'malformed reference rejected')
    assert(calls.length === before, 'malformed source never queried')
  }
  const noOwner = await verify(source, 'not-an-auth-uuid', reader(null))
  assert('error' in noOwner && noOwner.error === 'conversation_source_unavailable', 'unverified owner ID rejected')
  console.log('NPC conversation source owner gate tests passed (mocked lookup; no SQL/HTTP)')
}
main().catch(error => { throw error })
