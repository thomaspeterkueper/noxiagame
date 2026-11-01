import { prepareFeedbackSubmission } from './feedbackSubmissionGate'

/** Untrusted HTTP envelope validation. Conversation ownership MUST be verified separately server-side. */
export function parseFeedbackPostRequest(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false as const, error: 'invalid_request' }
  const body = input as Record<string, unknown>
  if (Object.keys(body).some(key => !['feedback', 'source', 'idempotencyKey'].includes(key))) return { ok: false as const, error: 'unexpected_fields' }
  if (typeof body.idempotencyKey !== 'string' || !/^[a-zA-Z0-9_-]{16,128}$/.test(body.idempotencyKey)) return { ok: false as const, error: 'invalid_idempotency_key' }
  if (!body.source || typeof body.source !== 'object' || Array.isArray(body.source)) return { ok: false as const, error: 'invalid_source' }
  const source = body.source as Record<string, unknown>
  // Never accept an ownership assertion from the browser, even when true.
  if (source.kind !== 'direct' || Object.keys(source).length !== 1) return { ok: false as const, error: 'conversation_requires_server_verification' }
  const prepared = prepareFeedbackSubmission(body.feedback, { kind: 'direct' })
  if (!prepared.ok) return { ok: false as const, error: 'invalid_feedback' }
  return { ok: true as const, feedback: prepared.feedback, source: prepared.source, idempotencyKey: body.idempotencyKey, status: prepared.status, canTriggerWorldChange: false as const }
}
