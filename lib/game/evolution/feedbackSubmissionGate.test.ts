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

for (const id of ['1', '42', '1234567890123456789']) {
  assert(prepare(draft, { kind: 'conversation', sourceRef: 'npc_conversation_log:' + id, ownerVerified: true }).ok, 'numeric verified source accepted: ' + id)
}
for (const id of ['0', '02', '4a', '4\\\\d', '12345678901234567890']) {
  assert(!prepare(draft, { kind: 'conversation', sourceRef: 'npc_conversation_log:' + id, ownerVerified: true }).ok, 'malformed source rejected: ' + id)
}

const publicDraft = { ...draft, visibility: 'public', consentToPublish: true }
assert(prepare(publicDraft, { kind: 'direct' }).ok, 'consented public draft without receipts accepted')
for (const field of ['title', 'description', 'locationRef'] as const) {
  const withReceipt = { ...publicDraft, [field]: field === 'title'
    ? 'NPC log npc_conversation_log:42'
    : field === 'description'
      ? 'Private NPC conversation receipt npc_conversation_log:42 must not be public.'
      : 'npc_conversation_log:42' }
  const result = prepare(withReceipt, { kind: 'direct' })
  assert(!result.ok && result.errors.includes('private_conversation_receipt_in_public_feedback'),
    'private NPC receipt blocked from public ' + field)
}
assert(!prepare({ ...publicDraft, description: 'A private receipt NPC_CONVERSATION_LOG : 42 must not be disclosed.' },
  { kind: 'conversation', sourceRef: 'npc_conversation_log:42', ownerVerified: true }).ok,
  'alternate case and spaces do not bypass receipt protection')
assert(prepare({ ...draft, description: 'A private receipt npc_conversation_log:42 may remain in a private draft.' },
  { kind: 'direct' }).ok, 'private drafts retain own private references')

console.log('Feedback submission gate tests passed')
