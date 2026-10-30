/**
 * Read-only, per-player projection of existing NPC conversation feature hints.
 * These are unreviewed statements, NOT civic proposals, votes or Core commands.
 * The route must query only the authenticated player's own log rows.
 */
export type ConversationWishKind = 'blocked' | 'missing' | 'wish' | 'seeking' | 'how_to'

export interface PlayerConversationSignal {
  id: string
  kind: ConversationWishKind
  subject: string
  npcDenied: boolean
  occurredAt: string
  /** Supplied by the conversation client; NOT an authenticated settlement ID. */
  unverifiedPlaceLabel: string | null
  sourceRef: string
  status: 'unreviewed'
  canTriggerWorldChange: false
}

const KINDS: readonly string[] = ['blocked', 'missing', 'wish', 'seeking', 'how_to']
const text = (value: unknown, max: number) => typeof value === 'string'
  ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
  : ''

/** The database id is bigint. Avoid lossy number-to-string conversion. */
function rowId(value: unknown): string | null {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0 ? String(value) : null
  return typeof value === 'string' && /^[1-9]\d{0,18}$/.test(value) ? value : null
}

export function projectPlayerConversationSignals(rows: readonly unknown[], requestedLimit = 20): PlayerConversationSignal[] {
  const limit = Number.isSafeInteger(requestedLimit) ? Math.max(1, Math.min(20, requestedLimit)) : 20
  const valid: PlayerConversationSignal[] = []
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue
    const r = row as Record<string, unknown>
    const id = rowId(r.id)
    const subject = text(r.wish_object, 120)
    if (!id || !KINDS.includes(String(r.wish_kind)) || subject.length < 3 ||
        r.opening !== false || !['reply', 'repeat_hint'].includes(String(r.outcome)) ||
        typeof r.created_at !== 'string' || !Number.isFinite(Date.parse(r.created_at))) continue
    valid.push({
      id, kind: r.wish_kind as ConversationWishKind, subject,
      npcDenied: r.wish_npc_denied === true,
      occurredAt: new Date(r.created_at).toISOString(),
      unverifiedPlaceLabel: text(r.location_name, 80) || null,
      sourceRef: `npc_conversation_log:${id}`,
      status: 'unreviewed', canTriggerWorldChange: false,
    })
  }
  // Conflicting records with the same receipt ID cannot be counted as evidence.
  const byId = new Map<string, PlayerConversationSignal>()
  const conflicts = new Set<string>()
  for (const signal of valid) {
    if (conflicts.has(signal.id)) continue
    const old = byId.get(signal.id)
    if (old && JSON.stringify(old) !== JSON.stringify(signal)) {
      byId.delete(signal.id)
      conflicts.add(signal.id)
    } else if (!old) byId.set(signal.id, signal)
  }
  return [...byId.values()]
    // Compare bigint receipt IDs as decimal strings (no Number conversion or locale-dependent ordering).
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) ||
      b.id.length - a.id.length || (b.id > a.id ? 1 : b.id < a.id ? -1 : 0))
    .slice(0, limit)
}
