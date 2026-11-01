import { projectFeedbackReceipt } from './feedbackReceipt'

/** Compare actual UTC instants, not ISO text: receipts may have different offsets.
 * Date.parse keeps milliseconds; PostgreSQL may supply six fractional digits,
 * so retain the remaining microseconds without unsafe Number arithmetic.
 * Called only after projectFeedbackReceipt validated the timestamp.
 */
function receiptInstantMicros(timestamp: string): bigint {
  const fraction = /\\.(\\d{1,6})(?:Z|[+-]\\d{2}:\\d{2})$/.exec(timestamp)?.[1] ?? ''
  return BigInt(Date.parse(timestamp)) * 1000n + BigInt(fraction.padEnd(6, '0').slice(3) || '0')
}

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
  return result.sort((a, b) => (receiptInstantMicros(a.createdAt) > receiptInstantMicros(b.createdAt) ? -1 : receiptInstantMicros(a.createdAt) < receiptInstantMicros(b.createdAt) ? 1 : a.id.localeCompare(b.id))).slice(0, limit)
}
