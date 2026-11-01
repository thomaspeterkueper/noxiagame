import { parseDirectFeedbackPost as parse } from './feedbackPostInput'
const assert = (ok: boolean, message: string) => { if (!ok) throw Error(message) }
const feedback = { category: 'idea', destination: 'world_initiative', title: 'Gemeinsame Werkstatt', description: 'Wir möchten eine offene Werkstatt in Seelenberg einrichten.', visibility: 'private' }
const key = 'feedback-key-12345678'
const valid = parse({ feedback, source: { kind: 'direct' } }, key)
assert(valid.ok && valid.feedback.destination === 'world_initiative' && valid.feedback.title === feedback.title, 'valid direct request')
assert(!parse({ feedback, source: { kind: 'direct' } }, 'short').ok, 'bad key')
assert(!parse({ feedback, source: { kind: 'direct' }, owner_user_id: 'spoof' }, key).ok, 'reject owner spoof')
assert(!parse({ feedback, source: { kind: 'direct' }, status: 'accepted_for_planning' }, key).ok, 'reject status spoof')
assert(!parse({ feedback, source: { kind: 'direct', ownerVerified: true } }, key).ok, 'reject source extras')
const conversation = parse({ feedback, source: { kind: 'conversation', sourceRef: 'npc_conversation_log:42', ownerVerified: true } }, key)
assert(conversation.ok === false, 'conversation must await server ownership check')
if (conversation.ok === false) assert(conversation.error === 'conversation_source_unavailable', 'explicit conversation error')
assert(!parse({ feedback: { ...feedback, title: 'x' }, source: { kind: 'direct' } }, key).ok, 'validate feedback')
assert(!parse({ feedback: { ...feedback, visibility: 'public' }, source: { kind: 'direct' } }, key).ok, 'public requires consent')
assert(!parse(null, key).ok, 'null envelope rejected')
assert(!parse([], key).ok, 'array envelope rejected')
assert(!parse({ feedback, source: null }, key).ok, 'null source rejected')
assert(!parse({ feedback, source: ['direct'] }, key).ok, 'array source rejected')
assert(!parse({ feedback, source: { kind: 'direct' }, idempotencyKey: key }, key).ok, 'body cannot override header key')
assert(!parse({ feedback, source: { kind: 'direct' } }, undefined).ok, 'missing header key rejected')
console.log('Direct feedback POST input contract passed')
