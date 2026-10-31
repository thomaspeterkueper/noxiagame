/** Adapter between PR #578's private conversation draft and the explicit feedback
 * intake contract. This is a local projection, NOT an authenticated submission.
 * The source receipt is private and must be reverified server-side before use.
 */
import { validateFeedback, type FeedbackDraft } from './playerFeedback'

export type ConversationFeedbackBridgeResult =
  | { ok: false; errors: string[]; status: 'local_feedback_draft'; canTriggerWorldChange: false }
  | {
      ok: true
      feedback: FeedbackDraft
      /** Never include this object in a public feedback payload. */
      privateProvenance: { sourceRef: string; verified: false }
      status: 'local_feedback_draft'
      canTriggerWorldChange: false
    }

const invalid = (error: string): ConversationFeedbackBridgeResult =>
  ({ ok: false, errors: [error], status: 'local_feedback_draft', canTriggerWorldChange: false })

/** Requires explicit player choices; no inferred publication consent or category. */
export function prepareConversationFeedbackDraft(localDraft: unknown, choices: unknown): ConversationFeedbackBridgeResult {
  if (!localDraft || typeof localDraft !== 'object' || Array.isArray(localDraft)) return invalid('invalid_local_draft')
  if (!choices || typeof choices !== 'object' || Array.isArray(choices)) return invalid('invalid_choices')
  const draft = localDraft as Record<string, unknown>
  const selection = choices as Record<string, unknown>
  if (draft.status !== 'local_draft' || draft.canTriggerWorldChange !== false ||
      typeof draft.sourceRef !== 'string' || !/^npc_conversation_log:[1-9]\d{0,18}$/.test(draft.sourceRef)) {
    return invalid('invalid_private_provenance')
  }
  const place = draft.unverifiedPlaceLabel
  if (place !== null && (typeof place !== 'string' || place.length < 1 || place.length > 80 ||
      place.trim() !== place || /[\u0000-\u001f\u007f]/.test(place))) {
    return invalid('invalid_unverified_place')
  }
  // Prevent accidental disclosure of a private receipt through ANY public text field.
  // This is a UX/privacy guard, not a substitute for moderation or server-side checks.
  if (selection.visibility === 'public' &&
      [draft.title, draft.description, place].some(v => typeof v === 'string' && /npc_conversation_log:[1-9]\d{0,18}/.test(v))) {
    return invalid('private_receipt_in_public_text')
  }
  const result = validateFeedback({
    category: selection.category,
    destination: selection.destination ?? 'world_initiative',
    title: draft.title,
    description: draft.description,
    ...(typeof place === 'string' ? { locationRef: place } : {}),
    visibility: selection.visibility,
    consentToPublish: selection.consentToPublish,
  })
  if (!result.valid || !result.normalized) {
    return { ok: false, errors: result.errors, status: 'local_feedback_draft', canTriggerWorldChange: false }
  }
  return {
    ok: true,
    feedback: result.normalized,
    privateProvenance: { sourceRef: draft.sourceRef as string, verified: false },
    status: 'local_feedback_draft',
    canTriggerWorldChange: false,
  }
}
