// Pure absence lifecycle. The server owns timestamps and persists transitions.
// UI timers are advisory only; the world tick is authoritative.
export const ABSENCE_POLICY = {
  warnAfterMs: 15 * 60_000,
  handoffAfterMs: 20 * 60_000,
  disconnectGraceMs: 90_000,
} as const

export type PresenceMode = 'online' | 'idle-warning' | 'away-autopilot'
export type AbsenceReason = 'idle' | 'logout' | 'disconnect'
export type DestinationKind = 'residence' | 'lodging' | 'hotel' | 'safe-hub'
export type AbsenceAction = 'none' | 'warn' | 'handoff' | 'resume'

export interface AbsenceState {
  mode: PresenceMode
  lastInteractionAt: number
  disconnectedAt: number | null
  handoffAt: number | null
  reason: AbsenceReason | null
  /** Incremented on handoff/reclaim; use as a fencing token for stale world jobs. */
  revision: number
}

export interface AbsenceDecision {
  state: AbsenceState
  action: AbsenceAction
  remainingMs: number | null
}

export interface AbsenceDestination {
  id: string
  kind: DestinationKind
  reachable: boolean
  available: boolean
  distanceMeters: number
}

/** Trusted game commands only, not pointer jitter, passive heartbeats or background polling. */
export function initialAbsenceState(now: number): AbsenceState {
  return { mode: 'online', lastInteractionAt: now, disconnectedAt: null, handoffAt: null, reason: null, revision: 0 }
}

function assertTime(now: number): void {
  if (!Number.isFinite(now) || now < 0) throw new Error('Invalid server timestamp')
}

export function advanceAbsence(
  previous: AbsenceState,
  now: number,
  event: 'tick' | 'interaction' | 'logout' | 'disconnect' | 'reconnect' = 'tick',
): AbsenceDecision {
  assertTime(now)
  if (event === 'reconnect' || event === 'interaction') {
    // A fresh, authenticated command reclaims player control, even en route.
    if (previous.mode === 'away-autopilot') {
      return { state: { ...previous, mode: 'online', lastInteractionAt: now, disconnectedAt: null, handoffAt: null, reason: null, revision: previous.revision + 1 }, action: 'resume', remainingMs: null }
    }
    return { state: { ...previous, mode: 'online', lastInteractionAt: now, disconnectedAt: null }, action: 'none', remainingMs: null }
  }
  if (previous.mode === 'away-autopilot') return { state: previous, action: 'none', remainingMs: null }

  if (event === 'logout') {
    return { state: { ...previous, mode: 'away-autopilot', reason: 'logout', handoffAt: now, disconnectedAt: null, revision: previous.revision + 1 }, action: 'handoff', remainingMs: null }
  }
  const disconnectedAt = event === 'disconnect' ? (previous.disconnectedAt ?? now) : previous.disconnectedAt
  if (disconnectedAt !== null) {
    const remaining = Math.max(0, ABSENCE_POLICY.disconnectGraceMs - Math.max(0, now - disconnectedAt))
    if (remaining > 0) return { state: { ...previous, disconnectedAt }, action: 'none', remainingMs: remaining }
    return { state: { ...previous, disconnectedAt, mode: 'away-autopilot', reason: 'disconnect', handoffAt: now, revision: previous.revision + 1 }, action: 'handoff', remainingMs: null }
  }

  const elapsed = Math.max(0, now - previous.lastInteractionAt)
  if (elapsed >= ABSENCE_POLICY.handoffAfterMs) {
    return { state: { ...previous, mode: 'away-autopilot', reason: 'idle', handoffAt: now, revision: previous.revision + 1 }, action: 'handoff', remainingMs: null }
  }
  if (elapsed >= ABSENCE_POLICY.warnAfterMs) {
    const state: AbsenceState = { ...previous, mode: 'idle-warning' }
    return { state, action: previous.mode === 'idle-warning' ? 'none' : 'warn', remainingMs: ABSENCE_POLICY.handoffAfterMs - elapsed }
  }
  return { state: previous, action: 'none', remainingMs: null }
}

/** Home before booked accommodation before the nearest available hotel, then safe public hub. */
export function chooseAbsenceDestination(destinations: readonly AbsenceDestination[]): AbsenceDestination | null {
  const eligible = destinations.filter(d => d.id && d.reachable && d.available && Number.isFinite(d.distanceMeters) && d.distanceMeters >= 0)
  const priority: Record<DestinationKind, number> = { residence: 0, lodging: 1, hotel: 2, 'safe-hub': 3 }
  return [...eligible].sort((a, b) => priority[a.kind] - priority[b.kind] || a.distanceMeters - b.distanceMeters || a.id.localeCompare(b.id))[0] ?? null
}

export type GoodbyeContext = 'conversation' | 'business' | 'casual'
/** Clearly system-generated; never invent commitments on behalf of the player. */
export function absenceGoodbye(context: GoodbyeContext): string {
  switch (context) {
    case 'business': return 'Ich muss für heute los. Auf Wiedersehen!'
    case 'conversation': return 'Ich muss mich jetzt verabschieden. Bis bald!'
    default: return 'Ich mache mich auf den Weg. Bis später!'
  }
}

/** No economy, relationship or consent-bearing actions can be issued by absence control. */
export const ABSENCE_ALLOWED_ACTIONS = ['close-conversation', 'navigate', 'enter-lodging', 'rest', 'sleep'] as const
export function isAbsenceActionAllowed(value: string): boolean {
  return (ABSENCE_ALLOWED_ACTIONS as readonly string[]).includes(value)
}

/** Server workers must compare the persisted revision before applying a queued move. */
export function ownsAbsenceLease(state: AbsenceState, expectedRevision: number): boolean {
  return state.mode === 'away-autopilot' && state.revision === expectedRevision
}
