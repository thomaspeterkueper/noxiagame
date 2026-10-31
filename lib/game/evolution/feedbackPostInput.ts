import { type FeedbackSubmissionPreparation } from './feedbackSubmissionGate'
import { parseFeedbackPostRequest } from './feedbackPostRequest'

/** Parse untrusted POST input. Conversation sources remain disabled until server-side
 * npc_conversation_log ownership can be verified; client ownerVerified is never trusted.
 */
export function parseDirectFeedbackPost(input: unknown, key: unknown):
  | { ok: true; feedback: Extract<FeedbackSubmissionPreparation, { ok: true }>['feedback']; key: string }
  | { ok: false; error: 'invalid_request' | 'invalid_idempotency_key' | 'conversation_source_unavailable' } {
  if (typeof key !== 'string' || !/^[a-zA-Z0-9_-]{16,128}$/.test(key))
    return { ok: false, error: 'invalid_idempotency_key' }
  if (!input || typeof input !== 'object' || Array.isArray(input))
    return { ok: false, error: 'invalid_request' }
  const body = input as Record<string, unknown>
  if (Object.keys(body).length !== 2 || !Object.hasOwn(body, 'feedback') || !Object.hasOwn(body, 'source'))
    return { ok: false, error: 'invalid_request' }
  if (!body.source || typeof body.source !== 'object' || Array.isArray(body.source))
    return { ok: false, error: 'invalid_request' }
  const source = body.source as Record<string, unknown>
  if (source.kind === 'conversation')
    return { ok: false, error: 'conversation_source_unavailable' }
  const prepared = parseFeedbackPostRequest({ feedback: body.feedback, source: body.source, idempotencyKey: key })
  if (!prepared.ok || prepared.source.kind !== 'direct')
    return { ok: false, error: 'invalid_request' }
  return { ok: true, feedback: prepared.feedback, key }
}
