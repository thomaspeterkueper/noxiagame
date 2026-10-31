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
const normalized = validateFeedback({ ...draft, locationRef: '  Seelenberg  ', hiddenWorldWrite: true }).normalized
assert(normalized?.locationRef === 'Seelenberg', 'location hint trimmed')
assert(!('hiddenWorldWrite' in (normalized ?? {})), 'unrecognized fields stripped')
assert(FEEDBACK_INTAKE_POLICY.createsWorldEvent === false && FEEDBACK_INTAKE_POLICY.executesCode === false, 'feedback never authorizes action')
console.log('Player feedback intake validation: tests passed')
