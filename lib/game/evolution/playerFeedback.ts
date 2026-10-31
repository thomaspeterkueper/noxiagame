/** Explicit player feedback is not a simulation observation or authorized command. */
export const FEEDBACK_CATEGORIES = ['idea', 'problem', 'building', 'profession', 'technology', 'gameplay', 'other'] as const
export type FeedbackCategory = typeof FEEDBACK_CATEGORIES[number]
export interface FeedbackDraft {
  category: FeedbackCategory
  title: string
  description: string
  /** Client-supplied, unverified place hint; never an ownership or settlement reference. */
  locationRef?: string
  visibility: 'private' | 'public'
  /** Explicit opt-in is required for public visibility; private submissions need no opt-in. */
  consentToPublish?: boolean
}
export interface FeedbackValidation {
  valid: boolean
  errors: string[]
  normalized?: FeedbackDraft
}

/** Validate untrusted HTTP/form input; validation does not confer civic authority. */
export function validateFeedback(input: unknown): FeedbackValidation {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { valid: false, errors: ['invalid_payload'] }
  }
  const value = input as Record<string, unknown>
  const errors: string[] = []
  const category = value.category
  const title = typeof value.title === 'string' ? value.title.trim() : ''
  const description = typeof value.description === 'string' ? value.description.trim() : ''
  const visibility = value.visibility
  const location = value.locationRef
  const consent = value.consentToPublish

  if (typeof category !== 'string' || !FEEDBACK_CATEGORIES.some(item => item === category)) errors.push('invalid_category')
  if (title.length < 5 || title.length > 120 || /[\u0000-\u001f\u007f]/.test(title)) errors.push('invalid_title')
  if (description.length < 20 || description.length > 5000 || /[\u0000-\u0008\u000b-\u001f\u007f]/.test(description)) errors.push('invalid_description')
  if (location !== undefined && (typeof location !== 'string' || location.trim().length > 200 || /[\u0000-\u001f\u007f]/.test(location))) errors.push('invalid_location')
  if (visibility !== 'private' && visibility !== 'public') errors.push('invalid_visibility')
  if (consent !== undefined && typeof consent !== 'boolean') errors.push('invalid_consent')
  if (visibility === 'public' && consent !== true) errors.push('publication_consent_required')

  if (errors.length) return { valid: false, errors }
  return {
    valid: true, errors: [],
    normalized: {
      category: category as FeedbackCategory,
      title,
      description,
      ...(typeof location === 'string' && location.trim() ? { locationRef: location.trim() } : {}),
      visibility: visibility as FeedbackDraft['visibility'],
      consentToPublish: consent === true,
    },
  }
}
/** Storage adapter must add authenticated owner, clock and server-side id. */
export const FEEDBACK_INTAKE_POLICY = {
  source: 'player_explicit_feedback',
  initialStatus: 'submitted_for_review',
  createsWorldEvent: false,
  executesCode: false,
  requiresAuthentication: true,
  requiresModeration: true,
} as const
