import { readPlayerFeedbackSubmissionResponse as parse } from './feedbackSubmitResponse'
const assert = (ok: boolean, message: string) => { if (!ok) throw Error(message) }
const receipt = { id: '123e4567-e89b-42d3-a456-426614174000', title: 'Gemeinsame Werkstatt', status: 'submitted_for_review', label: 'Eingereicht – wartet auf Prüfung', createdAt: '2026-10-31T09:00:00Z', createsWorldEvent: false, civicDecision: false, private_source_ref: 'secret' }
const valid = { authority: 'review_only', replay: false, receipt, internal_owner_id: 'secret' }
const parsed = parse(valid)
assert(parsed !== null && parsed.receipt.id === receipt.id && parsed.replay === false, 'valid receipt')
assert(!JSON.stringify(parsed).includes('secret'), 'strip all private fields')
assert(parse({ ...valid, replay: true })?.replay === true, 'idempotent replay')
assert(parse({ ...valid, authority: 'world_action' }) === null, 'reject claimed world authority')
assert(parse({ ...valid, receipt: { ...receipt, civicDecision: true } }) === null, 'reject civic claim')
assert(parse({ ...valid, receipt: { ...receipt, createsWorldEvent: true } }) === null, 'reject world event claim')
assert(parse({ ...valid, receipt: { ...receipt, status: 'approved' } }) === null, 'reject invalid status')
assert(parse({ ...valid, receipt: { ...receipt, label: 'Approved' } }) === null, 'reject forged label')
assert(parse({ ...valid, replay: 'false' }) === null, 'reject invalid replay')
assert(parse(null) === null && parse([]) === null, 'reject invalid envelope')
console.log('Feedback submission receipt response tests passed')
