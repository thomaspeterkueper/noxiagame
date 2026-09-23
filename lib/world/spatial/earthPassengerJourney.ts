import type { JourneyWorldObjectRef, PassengerArrivalNode } from '../../game/passengerJourney'
import { getEarthLandmark } from './earthLandmarks'
import { getEarthLandmarkArrivalNode } from './earthArrivalNodes'

export interface EarthPassengerTargetResolution {
  worldObject: JourneyWorldObjectRef
  arrivalNode: PassengerArrivalNode | null
  resolution: 'resolved' | 'arrival-node-unresolved'
}

/**
 * Earth owns the mapping from stable landmark identity to canonical arrival identity.
 * The resolved node is deliberately only a site/address anchor. It is not a guessed
 * entrance coordinate; world routing still has to resolve a routeable point/leg set.
 */
export function resolveEarthLandmarkPassengerTarget(landmarkId: string): EarthPassengerTargetResolution | null {
  const landmark = getEarthLandmark(landmarkId)
  if (!landmark) return null

  const arrivalNode = getEarthLandmarkArrivalNode(landmark.id)
  return {
    worldObject: { kind: 'earth-landmark', id: landmark.id },
    arrivalNode,
    resolution: arrivalNode ? 'resolved' : 'arrival-node-unresolved',
  }
}
