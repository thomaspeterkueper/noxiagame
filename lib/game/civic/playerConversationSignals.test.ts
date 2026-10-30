import { projectPlayerConversationSignals } from './playerConversationSignals'
const assert = (ok: boolean, message: string) => { if (!ok) throw Error(message) }
const row = (id: number | string, overrides: Record<string, unknown> = {}) => ({
  id, created_at: '2026-10-30T18:00:00Z', wish_kind: 'missing',
  wish_object: 'ein Treffpunkt', wish_npc_denied: false,
  location_name: 'Seelenberg', opening: false, outcome: 'reply',
  player_text: 'private conversation text', player_profile_id: 'private-user-id',
  ...overrides,
})
const projected = projectPlayerConversationSignals([row(2), row(1)])
assert(projected.length === 2 && projected[0].id === '2', 'deterministic order')
assert(projected[0].sourceRef === 'npc_conversation_log:2', 'provenance retained')
assert(projected[0].status === 'unreviewed' && projected[0].canTriggerWorldChange === false,
  'conversation cannot authorize a world change')
assert(projected[0].unverifiedPlaceLabel === 'Seelenberg', 'client place remains explicitly unverified')
assert(!JSON.stringify(projected).includes('private conversation text') &&
  !JSON.stringify(projected).includes('private-user-id'), 'no raw conversation or player identity exposed')
assert(projectPlayerConversationSignals([row(1), row(1)]).length === 1, 'replayed receipt deduplicated')
assert(projectPlayerConversationSignals([row(1), row(1, { wish_object: 'Abriss' })]).length === 0,
  'conflicting receipt id rejected')
assert(projectPlayerConversationSignals([row(1, { outcome: 'error' }), row(2, { opening: true }),
  row(3, { wish_kind: 'other' }), row(4, { wish_object: '' }), row(5, { id: 1.2 }),
  row(6, { created_at: 'nonsense' })]).length === 0, 'invalid/unsuccessful rows ignored')
assert(projectPlayerConversationSignals([row(1, { wish_npc_denied: 'true', location_name: '<x>\n'.repeat(100) })])[0].npcDenied === false,
  'untrusted boolean is not promoted')
assert(projectPlayerConversationSignals(Array.from({ length: 30 }, (_, i) => row(i + 1)), 100).length === 20,
  'bounded output')
assert(projectPlayerConversationSignals([null, false, 'x', {}]).length === 0, 'malformed rows safe')
const equalTime = projectPlayerConversationSignals([
  row('9'), row('10'), row('9223372036854775807'), row('9007199254740993'), row('11'),
])
assert(equalTime.map(s => s.id).join(',') === '9223372036854775807,9007199254740993,11,10,9',
  'same-timestamp bigint receipts ordered numerically without precision loss')
assert(projectPlayerConversationSignals([
  row('9223372036854775807', { created_at: '2026-10-29T18:00:00Z' }), row('9'),
])[0].id === '9', 'newer timestamp takes precedence over larger id')
console.log('Player conversation civic signals: tests passed')
