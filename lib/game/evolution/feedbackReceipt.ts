import { getPlayerFeedbackStatusView } from './feedbackReviewStatus'

/** Owner-scoped public projection. Caller MUST authenticate and enforce ownership before use. */
export function projectFeedbackReceipt(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const row = input as Record<string, unknown>
  if (typeof row.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(row.id)) return null
  if (typeof row.title !== 'string' || row.title.length < 5 || row.title.length > 120) return null
  const status = getPlayerFeedbackStatusView(row.status)
  if (!status) return null
  if (typeof row.created_at !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(row.created_at) || !Number.isFinite(Date.parse(row.created_at))) return null
  return { id: row.id, title: row.title, createdAt: row.created_at, ...status }
}
