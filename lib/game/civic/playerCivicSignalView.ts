/** Defensive client-side boundary for a private, read-only civic signal feed.
 * Never upgrades conversation hints into proposals, votes, verified places or Core authority.
 */
import type { PlayerConversationSignal } from './playerConversationSignals'

export type PlayerCivicSignalView = Pick<PlayerConversationSignal,
  'id' | 'kind' | 'subject' | 'npcDenied' | 'occurredAt' |
  'unverifiedPlaceLabel' | 'sourceRef' | 'status' | 'canTriggerWorldChange'>
export type PlayerCivicSignalResult = { ok: boolean; signals: PlayerCivicSignalView[] }

const kinds = new Set(['blocked', 'missing', 'wish', 'seeking', 'how_to'])
const validText = (v: unknown, max: number, min = 1): v is string =>
  typeof v === 'string' && v.length >= min && v.length <= max &&
  v.trim() === v && !/[\u0000-\u001f\u007f]/.test(v)
const validDate = (v: unknown): v is string =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v) &&
  Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v

export function readPlayerCivicSignalsPayload(input: unknown): PlayerCivicSignalResult {
  const invalid: PlayerCivicSignalResult = { ok: false, signals: [] }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return invalid
  const payload = input as Record<string, unknown>
  if (payload.scope !== 'own_conversations' || payload.authority !== 'none' ||
      !Array.isArray(payload.signals)) return invalid

  const found = new Map<string, PlayerCivicSignalView>()
  const conflicts = new Set<string>()
  for (const raw of payload.signals.slice(0, 100)) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue
    const s = raw as Record<string, unknown>
    if (!validText(s.id, 19) || !/^[1-9]\d{0,18}$/.test(s.id) ||
        !kinds.has(String(s.kind)) || !validText(s.subject, 120, 3) ||
        typeof s.npcDenied !== 'boolean' || !validDate(s.occurredAt) ||
        (s.unverifiedPlaceLabel !== null && !validText(s.unverifiedPlaceLabel, 80)) ||
        s.sourceRef !== `npc_conversation_log:${s.id}` ||
        s.status !== 'unreviewed' || s.canTriggerWorldChange !== false) continue

    const item: PlayerCivicSignalView = {
      id: s.id, kind: s.kind as PlayerCivicSignalView['kind'],
      subject: s.subject, npcDenied: s.npcDenied, occurredAt: s.occurredAt,
      unverifiedPlaceLabel: s.unverifiedPlaceLabel as string | null,
      sourceRef: s.sourceRef as string, status: 'unreviewed',
      canTriggerWorldChange: false,
    }
    if (conflicts.has(item.id)) continue
    const previous = found.get(item.id)
    if (previous && JSON.stringify(previous) !== JSON.stringify(item)) {
      found.delete(item.id)
      conflicts.add(item.id)
    } else if (!previous) found.set(item.id, item)
  }
  return { ok: true, signals: [...found.values()].slice(0, 20) }
}
