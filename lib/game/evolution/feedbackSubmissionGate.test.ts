import { prepareFeedbackSubmission as prepare } from './feedbackSubmissionGate'
const assert = (condition: boolean, message: string) => { if (!condition) throw Error(message) }
const draft = { category: 'building', title: 'Gemeinsame Werkstatt', description: 'Wir wünschen uns eine gemeinsame Werkstatt in Seelenberg.', visibility: 'private' }
const direct = prepare(draft, { kind: 'direct' })
assert(direct.ok && direct.status === 'submitted_for_review' && direct.canTriggerWorldChange === false, 'direct feedback is review-only')
assert(prepare(draft, { kind: 'conversation', sourceRef: 'npc_conversation_log:42', ownerVerified: true }).ok, 'verified conversation accepted')
for (const source of [null, {}, { kind: 'conversation', sourceRef: 'npc_conversation_log:42' }, { kind: 'conversation', sourceRef: 'npc_conversation_log:42', ownerVerified: 'true' }, { kind: 'conversation', sourceRef: 'npc_conversation_log:0', ownerVerified: true }, { kind: 'direct', canTriggerWorldChange: true }]) {
  assert(!prepare(draft, source).ok, 'invalid or unverified source rejected')
}
assert(!prepare({ ...draft, visibility: 'public' }, { kind: 'direct' }).ok, 'public feedback needs consent')
assert(!prepare({ ...draft, title: 'x' }, { kind: 'direct' }).ok, 'invalid feedback rejected')
console.log('Feedback submission gate tests passed')
