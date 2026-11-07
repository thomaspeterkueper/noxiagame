/** Pure, fail-closed submission gate shared by direct feedback and NPC-derived drafts.
 * Does not authenticate, persist, moderate or execute a world command.
 */
import { validateFeedback, type FeedbackDraft } from './playerFeedback'

export type FeedbackSubmissionSource =
  | { kind: 'direct' }
  | { kind: 'conversation'; sourceRef: string; ownerVerified: true }

export type FeedbackSubmissionPreparation =
  | { ok: false; errors: string[]; canTriggerWorldChange: false }
  | { ok: true; feedback: FeedbackDraft; source: FeedbackSubmissionSource; status: 'submitted_for_review'; canTriggerWorldChange: false }

export function prepareFeedbackSubmission(feedback: unknown, source: unknown): FeedbackSubmissionPreparation {
  const checked = validateFeedback(feedback)
  if (!checked.valid || !checked.normalized) {
    return { ok: false, errors: checked.errors, canTriggerWorldChange: false }
  }
  // Never publish private conversation receipt identifiers, even if a caller
  // bypasses the local conversation-to-feedback bridge. This guard is not
  // moderation or a substitute for server-side ownership verification.
  if (checked.normalized.visibility === 'public' &&
      [checked.normalized.title, checked.normalized.description, checked.normalized.locationRef]
        .some(text => typeof text === 'string' && /npc_conversation_log\s*:\s*\d+/i.test(text))) {
    return { ok: false, errors: ['private_conversation_receipt_in_public_feedback'], canTriggerWorldChange: false }
  }
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return { ok: false, errors: ['invalid_source'], canTriggerWorldChange: false }
  }
  const value = source as Record<string, unknown>
  if (value.kind === 'direct' && Object.keys(value).length === 1) {
    return { ok: true, feedback: checked.normalized, source: { kind: 'direct' }, status: 'submitted_for_review', canTriggerWorldChange: false }
  }
  if (value.kind === 'conversation' && value.ownerVerified === true &&
      typeof value.sourceRef === 'string' &&
      /^npc_conversation_log:[1-9]\d{0,18}$/.test(value.sourceRef) &&
      // The database identity is a signed PostgreSQL bigint, not any 19-digit number.
      BigInt(value.sourceRef.slice('npc_conversation_log:'.length)) <= 9223372036854775807n &&
      Object.keys(value).length === 3) {
    return { ok: true, feedback: checked.normalized, source: { kind: 'conversation', sourceRef: value.sourceRef, ownerVerified: true }, status: 'submitted_for_review', canTriggerWorldChange: false }
  }
  return { ok: false, errors: ['unverified_or_invalid_source'], canTriggerWorldChange: false }
}
