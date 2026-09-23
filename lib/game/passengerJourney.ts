// NOXIA Core passenger journey contract.
// Passenger journeys are intentionally separate from cargo transport_jobs and orbital travel().

export type PassengerTravelMode = 'road' | 'rail' | 'air' | 'mixed'

export type PassengerJourneyStatus =
  | 'planned'
  | 'boarding'
  | 'in_transit'
  | 'arrived'
  | 'cancelled'
  | 'failed'

export interface JourneyWorldObjectRef {
  kind: string
  id: string
}

export interface PassengerJourneyIntent {
  actorId: string | null
  target: JourneyWorldObjectRef
  mobilityMode: PassengerTravelMode
}

export interface PassengerArrivalNode {
  id: string
  worldId: string
  worldObject: JourneyWorldObjectRef
  /** World-owned provenance; a map/view coordinate is not sufficient. */
  authority: 'canonical-world-registry'
}

export interface PassengerJourneyLegSnapshot {
  id: string
  mode: Exclude<PassengerTravelMode, 'mixed'>
  originNodeId: string
  destinationNodeId: string
  distanceKm: number
  etaSeconds: number
  authority: string
}

export type PassengerJourneyBlockReason =
  | 'actor-unresolved'
  | 'arrival-node-unresolved'
  | 'route-unresolved'

export interface PassengerJourneyDraft {
  ready: boolean
  intent: PassengerJourneyIntent
  arrivalNode: PassengerArrivalNode | null
  legs: readonly PassengerJourneyLegSnapshot[]
  distanceKm: number | null
  etaSeconds: number | null
  blockReasons: PassengerJourneyBlockReason[]
}

export function buildPassengerJourneyDraft(input: {
  intent: PassengerJourneyIntent
  arrivalNode: PassengerArrivalNode | null
  legs?: readonly PassengerJourneyLegSnapshot[] | null
}): PassengerJourneyDraft {
  const blockReasons: PassengerJourneyBlockReason[] = []
  const legs = input.legs ?? []

  if (!input.intent.actorId?.trim()) blockReasons.push('actor-unresolved')
  if (!input.arrivalNode) blockReasons.push('arrival-node-unresolved')
  if (input.arrivalNode && legs.length === 0) blockReasons.push('route-unresolved')

  for (const leg of legs) {
    if (!Number.isFinite(leg.distanceKm) || leg.distanceKm <= 0
      || !Number.isFinite(leg.etaSeconds) || leg.etaSeconds <= 0) {
      throw new Error(`Invalid passenger journey leg: ${leg.id}`)
    }
  }

  const ready = blockReasons.length === 0
  const distanceKm = ready ? legs.reduce((sum, leg) => sum + leg.distanceKm, 0) : null
  const etaSeconds = ready ? legs.reduce((sum, leg) => sum + leg.etaSeconds, 0) : null

  return {
    ready,
    intent: input.intent,
    arrivalNode: input.arrivalNode,
    legs,
    distanceKm,
    etaSeconds,
    blockReasons: [...new Set(blockReasons)],
  }
}

const ALLOWED_TRANSITIONS: Readonly<Record<PassengerJourneyStatus, readonly PassengerJourneyStatus[]>> = {
  planned: ['boarding', 'cancelled', 'failed'],
  boarding: ['in_transit', 'cancelled', 'failed'],
  in_transit: ['arrived', 'failed'],
  arrived: [],
  cancelled: [],
  failed: [],
}

export function canTransitionPassengerJourney(
  from: PassengerJourneyStatus,
  to: PassengerJourneyStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to)
}

export function canEnterImmersiveSpace(status: PassengerJourneyStatus, spaceId: string | null): boolean {
  return status === 'arrived' && Boolean(spaceId?.trim())
}
