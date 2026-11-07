/** Query boundary for a private, owner-RLS-scoped feedback receipt list. */
export function parseFeedbackReceiptLimit(raw: string | null): number | null {
  if (raw === null) return 20
  if (!/^[1-9][0-9]?$/.test(raw)) return null
  const limit = Number(raw)
  return limit >= 1 && limit <= 50 ? limit : null
}
