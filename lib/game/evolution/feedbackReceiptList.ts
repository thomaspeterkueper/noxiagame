import { projectFeedbackReceipt } from './feedbackReceipt'

/** Compare actual UTC instants, not ISO text: receipts may have different offsets.
 * Date.parse keeps milliseconds; PostgreSQL may supply six fractional digits,
 * so retain the remaining microseconds without unsafe Number arithmetic.
 * Called only after projectFeedbackReceipt validated the timestamp.
 */
function receiptInstantMicros(timestamp: string): bigint {
  const fraction = /\.(\d{1,6})(?:Z|[+-]\d{2}:\d{2})$/.exec(timestamp)?.[1] ?? ''
  return BigInt(Date.parse(timestamp)) * BigInt(1000) + BigInt(fraction.padEnd(6, '0').slice(3) || '0')
}

/** Presentation-only projection of already owner-scoped rows; never performs authorization. */
export function projectFeedbackReceiptList(rows: unknown, limit = 50) {
  if (!Array.isArray(rows) || !Number.isInteger(limit) || limit < 1 || limit > 100) return null
  if (rows.length > 100) return null
  const result: NonNullable<ReturnType<typeof projectFeedbackReceipt>>[] = []
  const seenIds = new Set<string>()
  for (const row of rows) {
    const receipt = projectFeedbackReceipt(row)
    if (!receipt) return null // Fail closed rather than silently hiding corrupt records.
    // PostgreSQL UUIDs are case-insensitive. Reject duplicate logical identities,
    // including case variants, before applying the display limit.
    const canonicalId = receipt.id.toLowerCase()
    if (seenIds.has(canonicalId)) return null
    seenIds.add(canonicalId)
    result.push(receipt)
  }
  return result.sort((a, b) => {
    const aInstant = receiptInstantMicros(a.createdAt)
    const bInstant = receiptInstantMicros(b.createdAt)
    return aInstant === bInstant
      ? (a.id.toLowerCase() < b.id.toLowerCase() ? -1 : 1)
      : aInstant > bInstant ? -1 : 1
  }).slice(0, limit)
}
