import { parseFeedbackPostRequest as parse } from './feedbackPostRequest'
const assert = (condition: boolean, message: string) => { if (!condition) throw Error(message) }
const feedback = { category: 'idea', title: 'Neue Werkstatt', description: 'Eine gemeinschaftliche Werkstatt für Seelenberg.', visibility: 'private' }
const valid = { feedback, source: { kind: 'direct' }, idempotencyKey: 'feedback-request-0001' }
assert(parse(valid).ok === true, 'direct submission valid')
assert(parse({ ...valid, source: { kind: 'conversation', sourceRef: 'npc_conversation_log:12', ownerVerified: true } }).ok === false, 'browser cannot claim conversation ownership')
assert(parse({ ...valid, owner_user_id: 'spoofed' }).ok === false, 'owner injection rejected')
assert(parse({ ...valid, source: { kind: 'direct', ownerVerified: true } }).ok === false, 'source extra fields rejected')
assert(parse({ ...valid, idempotencyKey: 'short' }).ok === false, 'short key rejected')
assert(parse({ ...valid, feedback: { ...feedback, title: 'x' } }).ok === false, 'invalid feedback rejected')
console.log('Feedback POST envelope tests passed')
