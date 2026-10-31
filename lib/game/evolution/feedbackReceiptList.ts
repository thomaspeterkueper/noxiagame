import { projectFeedbackReceipt } from './feedbackReceipt'

/** Presentation-only projection of already owner-scoped rows; never performs authorization. */
export function projectFeedbackReceiptList(rows: unknown, limit = 50) {
  if (!Array.isArray(rows) || !Number.isInteger(limit) || limit < 1 || limit > 100) return null
  if (rows.length > 100) return null
  const result = []
  for (const row of rows) {
    const receipt = projectFeedbackReceipt(row)
    if (!receipt) return null // Fail closed rather than silently hiding corrupt records.
    result.push(receipt)
  }
  return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)).slice(0, limit)
}
