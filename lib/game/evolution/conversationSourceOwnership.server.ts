/**
 * Server-side, read-only provenance check for a player's NPC conversation turn.
 * A client-supplied receipt is never evidence of ownership. The caller MUST pass
 * the user ID obtained from verified Supabase authentication, not a request body.
 * This gate does not authorize publication, moderation, voting or Core writes.
 * Not wired to POST /api/game/feedback until end-to-end RLS/HTTP review.
 */

type ConversationLogRow = { id: unknown; player_profile_id: unknown }
type ConversationLogResult = { data: ConversationLogRow | null; error: unknown }
export type ConversationLogQuery = {
  eq(column: string, value: string): ConversationLogQuery
  maybeSingle(): PromiseLike<ConversationLogResult>
}
export type ConversationLogReader = {
  from(table: 'npc_conversation_log'): {
    select(columns: 'id,player_profile_id'): ConversationLogQuery
  }
}

export type ConversationSourceOwnership =
  | { ok: true; privateSourceRef: string; ownerVerified: true }
  | { ok: false; error: 'invalid_source_ref' | 'conversation_source_unavailable' }

const SOURCE = /^npc_conversation_log:([1-9][0-9]{0,18})$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const unavailable = (): ConversationSourceOwnership => ({ ok: false, error: 'conversation_source_unavailable' })

export async function verifyConversationSourceOwnership(
  sourceRef: unknown,
  verifiedOwnerId: unknown,
  reader: ConversationLogReader,
): Promise<ConversationSourceOwnership> {
  if (typeof sourceRef !== 'string') return { ok: false, error: 'invalid_source_ref' }
  const match = SOURCE.exec(sourceRef)
  if (!match) return { ok: false, error: 'invalid_source_ref' }
  // PostgreSQL bigint (identity) range; avoid unsafe numeric coercion.
  if (BigInt(match[1]) > 9223372036854775807n)
    return { ok: false, error: 'invalid_source_ref' }
  if (typeof verifiedOwnerId !== 'string' || !UUID.test(verifiedOwnerId)) return unavailable()
  try {
    // Double-scope the service-role lookup. Never fetch player_text or npc_reply.
    const { data, error } = await reader.from('npc_conversation_log')
      .select('id,player_profile_id')
      .eq('id', match[1])
      .eq('player_profile_id', verifiedOwnerId)
      .maybeSingle()
    if (error || !data || data.player_profile_id !== verifiedOwnerId) return unavailable()
    // Supabase may decode bigint as a JS number. Fail closed if it is unsafe.
    const rowId = typeof data.id === 'string' ? data.id :
      typeof data.id === 'number' && Number.isSafeInteger(data.id) ? String(data.id) : null
    if (rowId !== match[1]) return unavailable()
    return { ok: true, privateSourceRef: sourceRef, ownerVerified: true }
  } catch {
    // Identical error for foreign, absent and failed lookups: no existence oracle.
    return unavailable()
  }
}
