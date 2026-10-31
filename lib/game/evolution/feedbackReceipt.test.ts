import { projectFeedbackReceipt as project } from './feedbackReceipt'
const assert = (condition: boolean, message: string) => { if (!condition) throw Error(message) }
const row = { id: '123e4567-e89b-42d3-a456-426614174000', title: 'Gemeinsame Werkstatt', status: 'submitted_for_review', created_at: '2026-10-31T06:00:00Z', private_source_ref: 'npc_conversation_log:42', description: 'Private details', owner_user_id: 'private-user' }
const view = project(row)
assert(view !== null && view.status === 'submitted_for_review' && view.createsWorldEvent === false && view.civicDecision === false, 'receipt is review-only')
assert(!JSON.stringify(view).includes('npc_conversation_log') && !JSON.stringify(view).includes('Private details') && !JSON.stringify(view).includes('private-user'), 'private fields omitted')
for (const invalid of [null, [], { ...row, status: 'approved' }, { ...row, id: 'bad' }, { ...row, created_at: 'not-a-date' }, { ...row, title: 'x' }]) assert(project(invalid) === null, 'malformed receipt rejected')
console.log('Feedback receipt projection tests passed')
