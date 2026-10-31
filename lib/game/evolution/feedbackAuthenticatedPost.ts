/** Server-only intake gate: accepts NPC provenance only after checking the authenticated
 * Supabase Auth user against npc_conversation_log.player_profile_id. No client
 * ownerVerified claim, publication permission, or world/Core authority.
 */
import { parseDirectFeedbackPost } from './feedbackPostInput'
import { prepareFeedbackSubmission, type FeedbackSubmissionPreparation } from './feedbackSubmissionGate'
import { verifyConversationSourceOwnership, type ConversationLogReader } from './conversationSourceOwnership.server'

type NormalizedFeedback = Extract<FeedbackSubmissionPreparation, { ok: true }>['feedback']
export type AuthenticatedFeedbackPost =
  | { ok: true; feedback: NormalizedFeedback; key: string; sourceKind: 'direct' | 'conversation'; privateSourceRef: string | null }
  | { ok: false; error: 'invalid_request' | 'invalid_idempotency_key' | 'invalid_source_ref' | 'conversation_source_unavailable' }

export async function parseAuthenticatedFeedbackPost(
  input: unknown, key: unknown, verifiedOwnerId: unknown, reader: ConversationLogReader,
): Promise<AuthenticatedFeedbackPost> {
  const direct = parseDirectFeedbackPost(input, key)
  if (direct.ok) return { ...direct, sourceKind: 'direct', privateSourceRef: null }
  if (!input || typeof input !== 'object' || Array.isArray(input))
    return { ok: false, error: 'error' in direct ? direct.error : 'invalid_request' }
  const body = input as Record<string, unknown>
  if (!body.source || typeof body.source !== 'object' || Array.isArray(body.source))
    return { ok: false, error: 'error' in direct ? direct.error : 'invalid_request' }
  const source = body.source as Record<string, unknown>
  if (source.kind !== 'conversation')
    return { ok: false, error: 'error' in direct ? direct.error : 'invalid_request' }
  if (typeof key !== 'string' || !/^[a-zA-Z0-9_-]{16,128}$/.test(key))
    return { ok: false, error: 'invalid_idempotency_key' }
  // Browser may submit a source reference, never an ownership assertion.
  if (Object.keys(body).length !== 2 || !Object.hasOwn(body, 'feedback') ||
      !Object.hasOwn(body, 'source') || Object.keys(source).length !== 2 ||
      !Object.hasOwn(source, 'kind') || !Object.hasOwn(source, 'sourceRef'))
    return { ok: false, error: 'invalid_request' }

  const ownership = await verifyConversationSourceOwnership(source.sourceRef, verifiedOwnerId, reader)
  if (!ownership.ok) return { ok: false, error: 'error' in ownership ? ownership.error : 'conversation_source_unavailable' }
  const prepared = prepareFeedbackSubmission(body.feedback, {
    kind: 'conversation', sourceRef: ownership.privateSourceRef, ownerVerified: true,
  })
  if (!prepared.ok) return { ok: false, error: 'invalid_request' }
  return {
    ok: true, feedback: prepared.feedback, key, sourceKind: 'conversation',
    privateSourceRef: ownership.privateSourceRef,
  }
}
