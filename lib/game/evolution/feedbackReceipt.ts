import { getPlayerFeedbackStatusView } from './feedbackReviewStatus'

/** Require a real PostgreSQL timestamptz-style calendar instant with an explicit
 * timezone. Date.parse alone accepts normalized dates such as February 30 and
 * timezone-less strings; neither is reliable provenance for a player receipt.
 */
function validReceiptTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-](\d{2}):(\d{2}))$/.exec(value)
  if (!parts) return false
  const year = Number(parts[1]), month = Number(parts[2]), day = Number(parts[3])
  const hour = Number(parts[4]), minute = Number(parts[5]), second = Number(parts[6])
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  const offsetHour = Number(parts[9] ?? 0), offsetMinute = Number(parts[10] ?? 0)
  return year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1] &&
    hour <= 23 && minute <= 59 && second <= 59 && offsetHour <= 14 &&
    offsetMinute <= 59 && (offsetHour < 14 || offsetMinute === 0) &&
    Number.isFinite(Date.parse(value))
}

/** Owner-scoped public projection. Caller MUST authenticate and enforce ownership before use. */
export function projectFeedbackReceipt(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const row = input as Record<string, unknown>
  if (typeof row.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(row.id)) return null
  if (typeof row.title !== 'string' || row.title.length < 5 || row.title.length > 120) return null
  const status = getPlayerFeedbackStatusView(row.status)
  if (!status) return null
  if (!validReceiptTimestamp(row.created_at)) return null
  return { id: row.id, title: row.title, createdAt: row.created_at, ...status }
}
