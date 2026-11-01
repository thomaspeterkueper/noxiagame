/** Review workflow for future persisted player feedback.
 * This module is a pure contract, NOT authorization, persistence, publication
 * or a civic/engineering decision. The API must enforce moderator identity.
 */
export const FEEDBACK_REVIEW_STATUSES = [
  'submitted_for_review',
  'under_review',
  'needs_information',
  'accepted_for_planning',
  'declined',
  'closed',
] as const

export type FeedbackReviewStatus = typeof FEEDBACK_REVIEW_STATUSES[number]

export const FEEDBACK_STATUS_LABELS: Record<FeedbackReviewStatus, string> = {
  submitted_for_review: 'Eingereicht – wartet auf Prüfung',
  under_review: 'Wird geprüft',
  needs_information: 'Rückfrage offen',
  accepted_for_planning: 'Für weitere Planung angenommen',
  declined: 'Nicht angenommen',
  closed: 'Abgeschlossen',
}

const allowedTransitions: Record<FeedbackReviewStatus, readonly FeedbackReviewStatus[]> = {
  submitted_for_review: ['under_review'],
  under_review: ['needs_information', 'accepted_for_planning', 'declined', 'closed'],
  needs_information: ['under_review', 'closed'],
  accepted_for_planning: ['closed'],
  declined: [],
  closed: [],
}

/** Unknown stored values must never appear as an approved or actionable status. */
export function parseFeedbackReviewStatus(value: unknown): FeedbackReviewStatus | null {
  return typeof value === 'string' && FEEDBACK_REVIEW_STATUSES.some(status => status === value)
    ? value as FeedbackReviewStatus
    : null
}

/** Workflow adjacency only. This is not an access-control check. */
export function canTransitionFeedbackReviewStatus(from: unknown, to: unknown): boolean {
  const current = parseFeedbackReviewStatus(from)
  const next = parseFeedbackReviewStatus(to)
  return current !== null && next !== null && allowedTransitions[current].includes(next)
}

/** Public-facing projection; never exposes private provenance or raw conversation data. */
export function getPlayerFeedbackStatusView(value: unknown):
  | { status: FeedbackReviewStatus; label: string; createsWorldEvent: false; civicDecision: false }
  | null {
  const status = parseFeedbackReviewStatus(value)
  if (!status) return null
  return {
    status,
    label: FEEDBACK_STATUS_LABELS[status],
    createsWorldEvent: false,
    civicDecision: false,
  }
}
