import { parseAuthenticatedFeedbackPost as parse } from './feedbackAuthenticatedPost'
import type { ConversationLogReader } from './conversationSourceOwnership.server'

const assert = (ok: boolean, message: string) => { if (!ok) throw Error(message) }
const ownerA = '11111111-1111-4111-8111-111111111111'
const ownerB = '22222222-2222-4222-8222-222222222222'
const key = 'feedback-conversation-0001'
const feedback = {
  category: 'idea', destination: 'world_initiative', title: 'Gemeinsame Werkstatt',
  description: 'Wir möchten eine offene Werkstatt in Seelenberg einrichten.',
  visibility: 'private',
}
const conversation = (source: unknown) => ({ feedback, source })
let queries = 0
const reader = (id: unknown = '42', owner: unknown = ownerA, error: unknown = null): ConversationLogReader => ({
  from(table) {
    assert(table === 'npc_conversation_log', 'only private conversation log read')
    return {
      select(columns) {
        assert(columns === 'id,player_profile_id', 'never read transcript text')
        const conditions: Record<string, string> = {}
        const query = {
          eq(column: string, value: string) { conditions[column] = value; return query },
          async maybeSingle() {
            queries++
            assert(conditions.id === '42' && conditions.player_profile_id === ownerA,
              'source ID and authenticated owner are both scoped')
            return { data: id === null ? null : { id, player_profile_id: owner }, error }
          },
        }
        return query
      },
    }
  },
})

async function main() {
  const direct = await parse(conversation({ kind: 'direct' }), key, ownerA, reader())
  assert(direct.ok && direct.sourceKind === 'direct' && direct.privateSourceRef === null, 'direct stays valid')
  assert(queries === 0, 'direct feedback does not query conversation log')
  const own = await parse(conversation({ kind: 'conversation', sourceRef: 'npc_conversation_log:42' }), key, ownerA, reader())
  assert(own.ok && own.sourceKind === 'conversation' && own.privateSourceRef === 'npc_conversation_log:42', 'owned source accepted')
  assert(queries === 1, 'exactly one ownership read')
  const count = queries
  for (const source of [
    { kind: 'conversation', sourceRef: 'npc_conversation_log:42', ownerVerified: true },
    { kind: 'conversation', sourceRef: 'npc_conversation_log:42', owner_user_id: ownerA },
    { kind: 'conversation', sourceRef: 'npc_conversation_log:42', extra: 'x' },
  ]) {
    const result = await parse(conversation(source), key, ownerA, reader())
    assert('error' in result && result.error === 'invalid_request', 'client ownership claim/extra field rejected')
  }
  assert(queries === count, 'spoofed sources never queried')
  for (const [id, owner, error] of [
    ['42', ownerB, null], [null, ownerA, null], ['42', ownerA, { code: '42501' }],
    ['43', ownerA, null],
  ] as const) {
    const result = await parse(conversation({ kind: 'conversation', sourceRef: 'npc_conversation_log:42' }), key, ownerA, reader(id, owner, error))
    assert('error' in result && result.error === 'conversation_source_unavailable', 'foreign/missing/error source fail closed')
  }
  const malformed = await parse(conversation({ kind: 'conversation', sourceRef: 'npc_conversation_log:0' }), key, ownerA, reader())
  assert('error' in malformed && malformed.error === 'invalid_source_ref', 'malformed source rejected')
  const invalid = await parse({ feedback: { ...feedback, title: 'x' }, source: { kind: 'conversation', sourceRef: 'npc_conversation_log:42' } }, key, ownerA, reader())
  assert(!invalid.ok && invalid.error === 'invalid_request', 'invalid feedback rejected after ownership')
  const publicLeak = await parse({
    feedback: { ...feedback, visibility: 'public', consentToPublish: true, description: 'Private receipt npc_conversation_log:42 must not be published.' },
    source: { kind: 'conversation', sourceRef: 'npc_conversation_log:42' },
  }, key, ownerA, reader())
  assert(!publicLeak.ok, 'public private receipt leakage rejected')
  const extra = await parse({ ...conversation({ kind: 'conversation', sourceRef: 'npc_conversation_log:42' }), owner_user_id: ownerB }, key, ownerA, reader())
  assert('error' in extra && extra.error === 'invalid_request', 'body owner spoof rejected')
  console.log('Authenticated NPC feedback gate tests passed (mocked lookup, no SQL/HTTP)')
}
main().catch(error => { throw error })
