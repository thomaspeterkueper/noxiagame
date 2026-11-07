/** Untrusted POST response boundary. A server receipt is review-only, never civic approval. */
import { projectFeedbackReceipt } from './feedbackReceipt'

export function readPlayerFeedbackSubmissionResponse(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const envelope = input as Record<string, unknown>
  if (envelope.authority !== 'review_only' || typeof envelope.replay !== 'boolean' ||
      !envelope.receipt || typeof envelope.receipt !== 'object' || Array.isArray(envelope.receipt)) return null
  const row = envelope.receipt as Record<string, unknown>
  if (row.createsWorldEvent !== false || row.civicDecision !== false) return null
  const receipt = projectFeedbackReceipt({
    id: row.id, title: row.title, status: row.status, created_at: row.createdAt,
  })
  if (!receipt || receipt.label !== row.label) return null
  return { receipt, replay: envelope.replay, authority: 'review_only' as const }
}
