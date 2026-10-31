import { readPlayerFeedbackReceiptsPayload as read } from './feedbackReceiptResponse'
const check = (ok: boolean, message: string) => { if (!ok) throw Error(message) }
const item = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  title: 'Gemeinsame Werkstatt', status: 'submitted_for_review',
  label: 'Eingereicht – wartet auf Prüfung',
  createdAt: '2026-10-31T06:00:00Z',
  createsWorldEvent: false, civicDecision: false,
  owner_user_id: 'private-owner', private_source_ref: 'npc_conversation_log:42',
}
const payload = (receipts: unknown, patch: Record<string, unknown> = {}) =>
  ({ scope: 'own_submissions', authority: 'review_only', receipts, ...patch })
const parsed = read(payload([item]))
check(parsed.ok && parsed.receipts.length === 1, 'valid owner receipt accepted')
check(!JSON.stringify(parsed).includes('private-owner') && !JSON.stringify(parsed).includes('npc_conversation_log'), 'private fields stripped')
check(read(payload([])).ok, 'empty list valid')
check(!read(payload([item], { scope: 'all_players' })).ok, 'owner scope required')
check(!read(payload([item], { authority: 'core' })).ok, 'review-only authority required')
check(!read(payload([item, item])).ok, 'duplicate receipt ids rejected')
check(!read(payload([item, { ...item, id: '123e4567-e89b-42d3-a456-426614174001', status: 'approved' }])).ok, 'unknown status rejected')
check(!read(payload([{ ...item, createsWorldEvent: true }])).ok, 'world action claim rejected')
check(!read(payload([{ ...item, civicDecision: true }])).ok, 'civic decision claim rejected')
check(!read(payload([{ ...item, label: 'Genehmigt' }])).ok, 'forged label rejected')
check(!read(payload(Array.from({ length: 51 }, () => item))).ok, 'unbounded payload rejected')
check(!read(payload('invalid')).ok && !read(null).ok, 'malformed envelope rejected')
console.log('Feedback receipt response boundary passed')
