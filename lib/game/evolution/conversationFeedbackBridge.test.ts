import { prepareConversationFeedbackDraft as prepare } from './conversationFeedbackBridge'
const assert = (ok: boolean, message: string) => { if (!ok) throw Error(message) }
const draft = {
  title: 'Prüfanliegen: gemeinsamer Treffpunkt',
  description: 'Ein NPC-Gespräch deutet auf einen Bedarf für einen gemeinsamen Treffpunkt hin.',
  sourceRef: 'npc_conversation_log:42', unverifiedPlaceLabel: 'Seelenberg',
  status: 'local_draft', canTriggerWorldChange: false,
}
const privateResult = prepare(draft, { category: 'building', visibility: 'private' })
assert(privateResult.ok, 'explicit private choice accepted')
if (!privateResult.ok) throw Error('missing valid private result')
assert(privateResult.feedback.category === 'building' && privateResult.feedback.locationRef === 'Seelenberg',
  'feedback contract retains category and unverified place hint')
assert(privateResult.privateProvenance.sourceRef === draft.sourceRef && !privateResult.privateProvenance.verified,
  'private receipt retained separately and never treated as verified')
assert(!JSON.stringify(privateResult.feedback).includes('npc_conversation_log'),
  'public-facing feedback payload does not include private receipt')
assert(privateResult.status === 'local_feedback_draft' && !privateResult.canTriggerWorldChange,
  'no civic or world authority')
assert(!prepare(draft, { category: 'building', visibility: 'public' }).ok,
  'public posting requires explicit opt-in')
assert(!prepare(draft, { category: 'building', visibility: 'public', consentToPublish: 'true' }).ok,
  'truthy string is not publication consent')
const publicResult = prepare(draft, { category: 'building', visibility: 'public', consentToPublish: true })
assert(publicResult.ok && publicResult.feedback.visibility === 'public', 'explicit public choice accepted')
assert(!prepare({ ...draft, description: `Private source: ${draft.sourceRef}` },
  { category: 'idea', visibility: 'public', consentToPublish: true }).ok,
  'public feedback must not accidentally expose private source reference')
assert(prepare({ ...draft, description: `Private source: ${draft.sourceRef}` },
  { category: 'idea', visibility: 'private' }).ok, 'private drafts may retain their own reference')
for (const altered of [
  null, {}, { ...draft, status: 'approved' }, { ...draft, canTriggerWorldChange: true },
  { ...draft, sourceRef: 'vote:42' }, { ...draft, sourceRef: 'npc_conversation_log:0' },
  { ...draft, sourceRef: 'npc_conversation_log:12345678901234567890' },
  { ...draft, unverifiedPlaceLabel: 'Seelenberg\nverified' },
  { ...draft, unverifiedPlaceLabel: 42 },
]) assert(!prepare(altered, { category: 'idea', visibility: 'private' }).ok, 'untrusted draft rejected')
for (const altered of [null, [], {}, { category: 'unlisted', visibility: 'private' },
  { category: 'idea', visibility: 'approved' }]) {
  assert(!prepare(draft, altered).ok, 'invalid player choice rejected')
}
assert(!prepare({ ...draft, title: 'x' }, { category: 'idea', visibility: 'private' }).ok,
  'existing feedback validation reused')
assert(prepare({ ...draft, unverifiedPlaceLabel: null }, { category: 'idea', visibility: 'private' }).ok,
  'no place is invented')
console.log('Conversation-to-feedback local bridge tests passed')
