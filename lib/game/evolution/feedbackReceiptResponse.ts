/** Defensive browser boundary for private, owner-RLS-scoped feedback receipts.
 * Parsing never authorizes publication, moderation or a Core world event.
 */
import { projectFeedbackReceipt } from './feedbackReceipt'

export type PlayerFeedbackReceiptView = NonNullable<ReturnType<typeof projectFeedbackReceipt>>
export type PlayerFeedbackReceiptResponse = { ok: boolean; receipts: PlayerFeedbackReceiptView[] }

export function readPlayerFeedbackReceiptsPayload(input: unknown): PlayerFeedbackReceiptResponse {
  const invalid: PlayerFeedbackReceiptResponse = { ok: false, receipts: [] }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return invalid
  const envelope = input as Record<string, unknown>
  if (envelope.scope !== 'own_submissions' || envelope.authority !== 'review_only' ||
      !Array.isArray(envelope.receipts) || envelope.receipts.length > 50) return invalid

  const receipts: PlayerFeedbackReceiptView[] = []
  const seen = new Set<string>()
  for (const item of envelope.receipts) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return invalid
    const row = item as Record<string, unknown>
    // Fail closed if an API response claims civic or Core authority.
    if (row.createsWorldEvent !== false || row.civicDecision !== false) return invalid
    const receipt = projectFeedbackReceipt({
      id: row.id, title: row.title, status: row.status, created_at: row.createdAt,
    })
    if (!receipt || row.label !== receipt.label || seen.has(receipt.id)) return invalid
    seen.add(receipt.id)
    receipts.push(receipt) // Re-project: never forward unknown or private fields.
  }
  return { ok: true, receipts }
}
