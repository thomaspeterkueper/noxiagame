import { readPlayerCivicSignalsPayload as read } from './playerCivicSignalView'
const check = (ok: boolean, message: string) => { if (!ok) throw Error(message) }
const row = (id: string, patch: Record<string, unknown> = {}) => ({
  id, kind: 'missing', subject: 'ein Treffpunkt', npcDenied: false,
  occurredAt: '2026-10-30T18:00:00.000Z', unverifiedPlaceLabel: 'Seelenberg',
  sourceRef: `npc_conversation_log:${id}`, status: 'unreviewed',
  canTriggerWorldChange: false, player_text: 'geheimer Gesprächsinhalt', ...patch,
})
const envelope = (signals: unknown, patch: Record<string, unknown> = {}) =>
  ({ scope: 'own_conversations', authority: 'none', signals, ...patch })
const result = read(envelope([row('1')]))
check(result.ok && result.signals.length === 1, 'valid private signal shown')
check(result.signals[0].unverifiedPlaceLabel === 'Seelenberg', 'place remains labelled unverified')
check(!JSON.stringify(result).includes('geheimer Gesprächsinhalt'), 'extra private fields not forwarded')
check(read(envelope([])).ok, 'empty valid response is not an error')
check(!read(envelope([row('1')], { scope: 'all_players' })).ok, 'scope mismatch rejected')
check(!read(envelope([row('1')], { authority: 'core' })).ok, 'authority mismatch rejected')
check(!read(envelope('not an array')).ok, 'invalid envelope rejected')
check(!read(null).ok, 'null envelope rejected')
check(read(envelope([row('1', { canTriggerWorldChange: true })])).signals.length === 0,
  'world-change claims rejected')
check(read(envelope([row('1', { status: 'approved' })])).signals.length === 0,
  'approval claims rejected')
check(read(envelope([row('1', { sourceRef: 'vote:1' })])).signals.length === 0,
  'invalid provenance rejected')
check(read(envelope([row('1', { unverifiedPlaceLabel: 'Seelenberg\nverified' })])).signals.length === 0,
  'control characters in location rejected')
check(read(envelope([row('1', { occurredAt: 'not-a-date' })])).signals.length === 0,
  'invalid dates rejected')
check(read(envelope([row('1', { npcDenied: 'false' })])).signals.length === 0,
  'truthy strings not treated as booleans')
check(read(envelope([row('1'), row('1')])).signals.length === 1,
  'replayed identical receipts deduplicated')
check(read(envelope([row('1'), row('1', { subject: 'Abriss' })])).signals.length === 0,
  'conflicting receipts excluded')
check(read(envelope(Array.from({ length: 30 }, (_, i) => row(String(i + 1))))).signals.length === 20,
  'bounded result')
console.log('Player civic signal view boundary: tests passed')
