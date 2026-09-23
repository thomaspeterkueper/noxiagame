import type { JourneyWorldObjectRef, PassengerArrivalNode } from '@/lib/game/passengerJourney'
import { getEarthLandmark } from './earthLandmarks'

export interface EarthPassengerTargetResolution {
  worldObject: JourneyWorldObjectRef
  arrivalNode: PassengerArrivalNode | null
  resolution: 'resolved' | 'arrival-node-unresolved'
}

/**
 * Earth owns the mapping from a stable landmark identity to a canonical arrival node.
 * The current landmark registry does not yet contain authoritative visitor entrances /
 * transit hubs, so this resolver deliberately fails closed instead of promoting the
 * presentation coordinates from EarthLandmarkMap into travel authority.
 */
export function resolveEarthLandmarkPassengerTarget(landmarkId: string): EarthPassengerTargetResolution | null {
  const landmark = getEarthLandmark(landmarkId)
  if (!landmark) return null

  return {
    worldObject: { kind: 'earth-landmark', id: landmark.id },
    arrivalNode: null,
    resolution: 'arrival-node-unresolved',
  }
}
