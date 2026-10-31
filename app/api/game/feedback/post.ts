/** Authenticated direct feedback intake; review-only, no world/Core writes.
 * Requires the separately reviewed SQL migration including its atomic rate trigger.
 * Conversation sources are deliberately rejected until server ownership checks exist.
 */
import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'
import { parseDirectFeedbackPost } from '@/lib/game/evolution/feedbackPostInput'
import { classifyFeedbackRetry } from '@/lib/game/evolution/feedbackIdempotency'
import { projectFeedbackReceipt } from '@/lib/game/evolution/feedbackReceipt'

const PRIVATE = { 'Cache-Control': 'private, no-store' }
const reply = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  NextResponse.json(body, { status, headers: { ...PRIVATE, ...headers } })
const MAX_BODY_BYTES = 8192

async function readBoundedBody(req: NextRequest): Promise<string | null> {
  if (!req.body) return null
  const reader = req.body.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let size = 0
  let result = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_BODY_BYTES) {
        await reader.cancel()
        return null
      }
      result += decoder.decode(value, { stream: true })
    }
    return result + decoder.decode()
  } catch {
    return null
  } finally {
    reader.releaseLock()
  }
}

export async function POST(req: NextRequest) {
  const ownerId = await verifiedBearerUserId(req)
  if (!ownerId) return reply({ error: 'unauthorized' }, 401)
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    return reply({ error: 'feedback_unavailable' }, 503)
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers.get('content-type') ?? ''))
    return reply({ error: 'json_required' }, 415)
  const declaredSize = Number(req.headers.get('content-length'))
  if (Number.isFinite(declaredSize) && declaredSize > MAX_BODY_BYTES)
    return reply({ error: 'payload_too_large' }, 413)
  const raw = await readBoundedBody(req)
  if (raw === null) return reply({ error: 'payload_too_large_or_invalid' }, 413)
  let body: unknown
  try { body = JSON.parse(raw) } catch { return reply({ error: 'invalid_json' }, 400) }
  const parsed = parseDirectFeedbackPost(body, req.headers.get('idempotency-key'))
  if (!parsed.ok) return reply({ error: parsed.error }, parsed.error === 'conversation_source_unavailable' ? 422 : 400)

  // Hash the normalized content, not untrusted JSON key order or client identity.
  const fingerprint = createHash('sha256')
    .update(JSON.stringify({ feedback: parsed.feedback, source: 'direct' }))
    .digest('hex')
  const db = createServiceClient()
  const findExisting = () => db.from('player_feedback_submissions')
    .select('id,owner_user_id,idempotency_key,payload_fingerprint,title,status,created_at')
    .eq('owner_user_id', ownerId)
    .eq('idempotency_key', parsed.key)
    .maybeSingle()
  try {
    const existing = await findExisting()
    if (existing.error) return reply({ error: 'feedback_unavailable' }, 503)
    const verdict = classifyFeedbackRetry(existing.data, ownerId, parsed.key, fingerprint)
    if (verdict === 'invalid') return reply({ error: 'invalid_idempotency_key' }, 400)
    if (verdict === 'conflict') return reply({ error: 'idempotency_conflict' }, 409)
    if (verdict === 'replay') {
      const receipt = projectFeedbackReceipt(existing.data)
      return receipt ? reply({ receipt, replay: true, authority: 'review_only' }) :
        reply({ error: 'feedback_unavailable' }, 503)
    }

    const { data, error } = await db.from('player_feedback_submissions').insert({
      owner_user_id: ownerId,
      destination: parsed.feedback.destination ?? 'development',
      category: parsed.feedback.category,
      title: parsed.feedback.title,
      description: parsed.feedback.description,
      location_hint: parsed.feedback.locationRef ?? null,
      requested_visibility: parsed.feedback.visibility,
      publication_consent: parsed.feedback.consentToPublish === true,
      source_kind: 'direct',
      private_source_ref: null,
      status: 'submitted_for_review',
      idempotency_key: parsed.key,
      payload_fingerprint: fingerprint,
    }).select('id,title,status,created_at').single()
    if (error) {
      // A concurrent identical request may have won the unique key race.
      if (error.code === '23505') {
        const concurrent = await findExisting()
        if (concurrent.error) return reply({ error: 'feedback_unavailable' }, 503)
        const retry = classifyFeedbackRetry(concurrent.data, ownerId, parsed.key, fingerprint)
        if (retry === 'conflict') return reply({ error: 'idempotency_conflict' }, 409)
        const receipt = retry === 'replay' ? projectFeedbackReceipt(concurrent.data) : null
        return receipt ? reply({ receipt, replay: true, authority: 'review_only' }) :
          reply({ error: 'feedback_unavailable' }, 503)
      }
      if (error.code === 'P0001' && error.message.includes('feedback_rate_limit_exceeded'))
        return reply({ error: 'rate_limited' }, 429, { 'Retry-After': '3600' })
      console.error('feedback insert failed', { code: error.code })
      return reply({ error: 'feedback_unavailable' }, 503)
    }
    const receipt = projectFeedbackReceipt(data)
    return receipt ? reply({ receipt, replay: false, authority: 'review_only' }, 201) :
      reply({ error: 'feedback_unavailable' }, 503)
  } catch {
    return reply({ error: 'feedback_unavailable' }, 503)
  }
}
