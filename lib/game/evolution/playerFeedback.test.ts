import { validateFeedback, FEEDBACK_INTAKE_POLICY, type FeedbackDraft } from './playerFeedback'
const assert = (ok: boolean, message: string) => { if (!ok) throw Error(message) }
const draft: FeedbackDraft = {
  category: 'building', title: 'Gemeinsame Werkstatt',
  description: 'Wir möchten eine gemeinsam betriebene Werkstatt in Seelenberg.',
  visibility: 'private', locationRef: 'seelenberg',
}
assert(validateFeedback(draft).valid, 'private draft accepted')
assert(validateFeedback({ ...draft, visibility: 'public' }).errors.includes('publication_consent_required'), 'public without opt-in rejected')
assert(validateFeedback({ ...draft, visibility: 'public', consentToPublish: true }).valid, 'explicit public opt-in accepted')
assert(validateFeedback({ ...draft, visibility: 'public', consentToPublish: 'true' }).valid === false, 'truthy string cannot grant publication consent')
assert(validateFeedback({ ...draft, title: 'x' }).valid === false, 'short title rejected')
assert(validateFeedback({ ...draft, description: 'x' }).valid === false, 'short description rejected')
assert(validateFeedback({ ...draft, description: 'x'.repeat(5001) }).valid === false, 'oversized description rejected')
assert(validateFeedback({ ...draft, category: 'unknown' }).valid === false, 'unknown category rejected')
assert(validateFeedback({ ...draft, visibility: 'unknown' }).valid === false, 'invalid visibility rejected')
for (const input of [null, undefined, 12, 'text', [], {}, { ...draft, title: null }, { ...draft, description: {} }, { ...draft, locationRef: 7 }]) {
  assert(!validateFeedback(input).valid, 'malformed runtime input rejected')
}
assert(!validateFeedback({ ...draft, title: 'Bad\nverified' }).valid, 'title control characters rejected')
assert(!validateFeedback({ ...draft, locationRef: 'Seelenberg\nverified' }).valid, 'location control characters rejected')
assert(!validateFeedback({ ...draft, description: 'A sufficiently long description\u0000with control' }).valid, 'description binary control rejected')
assert(validateFeedback({ ...draft, description: 'A sufficiently long\nmultiline description' }).valid, 'legitimate multiline description accepted')
const normalized = validateFeedback({ ...draft, locationRef: '  Seelenberg  ' }).normalized
assert(normalized?.locationRef === 'Seelenberg', 'location hint trimmed')
for (const extra of [
  { hiddenWorldWrite: true }, { owner_user_id: 'other-player' },
  { status: 'accepted_for_planning' }, { canTriggerWorldChange: true },
  { votes: 999 }, { sourceRef: 'npc_conversation_log:42' },
]) {
  const result = validateFeedback({ ...draft, ...extra })
  assert(!result.valid && result.errors.includes('unexpected_feedback_fields'),
    'unknown or authority-claiming feedback metadata must be rejected')
}
const protoKey = JSON.parse('{"__proto__":{"status":"approved"}}')
assert(!validateFeedback({ ...draft, ...protoKey }).valid, 'JSON prototype-like key rejected')
assert(FEEDBACK_INTAKE_POLICY.createsWorldEvent === false && FEEDBACK_INTAKE_POLICY.executesCode === false, 'feedback never authorizes action')
console.log('Player feedback intake validation: tests passed')

assert(validateFeedback({ ...draft, destination: 'world_initiative' }).normalized?.destination === 'world_initiative', 'world initiative preserved')
assert(!validateFeedback({ ...draft, destination: 'admin_approved' }).valid, 'invalid destination rejected')
