/**
 * NOXIA #551: deterministic, side-effect-free group visit lifecycle.
 * Adapter boundary only: navigation, venue access, world state and persistence
 * must be validated by the authoritative game services before applying events.
 */
export type VisitPhase = 'invited' | 'travelling' | 'inside' | 'finished' | 'cancelled'
export type GroupVisit = Readonly<{
  id: string
  venueId: string
  initiatorId: string
  memberIds: readonly string[]
  phase: VisitPhase
  arrivedIds: readonly string[]
  enteredIds: readonly string[]
  startedAt: number
  endedAt?: number
}>
export type VisitEvent =
  | { type: 'accept'; actorId: string }
  | { type: 'decline'; actorId: string }
  | { type: 'arrive'; actorId: string; routeConfirmed: boolean }
  | { type: 'enter'; actorId: string; accessGranted: boolean; freeVisitorSlots: number }
  | { type: 'leave'; actorId: string }
  | { type: 'cancel'; actorId: string }

export type VisitResult = Readonly<{ visit: GroupVisit; changed: boolean; reason?: string }>

const unique = (ids: readonly string[]) => [...new Set(ids)]
const valid = (id: string) => id.trim().length > 0

export function inviteToVenue(input: {
  id: string; venueId: string; initiatorId: string; invitedId: string; now: number
}): GroupVisit {
  if (![input.id, input.venueId, input.initiatorId, input.invitedId].every(valid) ||
    input.initiatorId === input.invitedId || !Number.isFinite(input.now))
    throw new Error('invalid_group_visit')
  return Object.freeze({
    id: input.id, venueId: input.venueId, initiatorId: input.initiatorId,
    memberIds: [input.initiatorId], phase: 'invited' as const,
    arrivedIds: [], enteredIds: [], startedAt: input.now,
  })
}

/** Reducer does not pretend that arriving or access succeeded without evidence. */
export function applyVisitEvent(visit: GroupVisit, event: VisitEvent, now: number): VisitResult {
  const unchanged = (reason: string): VisitResult => ({ visit, changed: false, reason })
  if (!Number.isFinite(now) || now < visit.startedAt) return unchanged('invalid_time')
  if (visit.phase === 'finished' || visit.phase === 'cancelled') return unchanged('terminal')
  const members = visit.memberIds
  if (event.type === 'accept') {
    if (visit.phase !== 'invited' || !valid(event.actorId) || members.includes(event.actorId))
      return unchanged('not_invitable')
    // Invite/consent is an upstream responsibility: reducer is not an invitation verifier.
    return { visit: { ...visit, memberIds: [...members, event.actorId], phase: 'travelling' }, changed: true }
  }
  if (event.type === 'decline') return unchanged('declined_no_membership')
  if (!members.includes(event.actorId)) return unchanged('not_a_member')
  if (event.type === 'cancel') {
    if (event.actorId !== visit.initiatorId) return unchanged('not_initiator')
    return { visit: { ...visit, phase: 'cancelled', endedAt: now }, changed: true }
  }
  if (event.type === 'arrive') {
    if (!event.routeConfirmed || visit.phase !== 'travelling') return unchanged('route_not_confirmed')
    if (visit.arrivedIds.includes(event.actorId)) return unchanged('already_arrived')
    return { visit: { ...visit, arrivedIds: [...visit.arrivedIds, event.actorId] }, changed: true }
  }
  if (event.type === 'enter') {
    if (visit.phase !== 'travelling' && visit.phase !== 'inside') return unchanged('not_at_venue')
    if (!visit.arrivedIds.includes(event.actorId)) return unchanged('not_arrived')
    if (!event.accessGranted || !Number.isInteger(event.freeVisitorSlots) || event.freeVisitorSlots < 1)
      return unchanged('venue_unavailable')
    if (visit.enteredIds.includes(event.actorId)) return unchanged('already_inside')
    return { visit: { ...visit, enteredIds: [...visit.enteredIds, event.actorId], phase: 'inside' }, changed: true }
  }
  if (event.type === 'leave') {
    if (!visit.enteredIds.includes(event.actorId)) return unchanged('not_inside')
    const enteredIds = visit.enteredIds.filter(id => id !== event.actorId)
    const membersRemaining = members.filter(id => id !== event.actorId)
    const finished = enteredIds.length === 0 && membersRemaining.length === 0
    return {
      visit: { ...visit, memberIds: membersRemaining, enteredIds,
        phase: finished ? 'finished' : 'inside', ...(finished ? { endedAt: now } : {}) },
      changed: true,
    }
  }
  return unchanged('unknown_event')
}

/** All members need to have entered at least once before a shared scene can begin. */
export function groupCanSocialize(visit: GroupVisit): boolean {
  return visit.phase === 'inside' && visit.memberIds.length >= 2 &&
    visit.memberIds.every(id => visit.enteredIds.includes(id))
}
