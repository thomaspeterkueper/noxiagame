import type { PassengerArrivalNode } from '../../game/passengerJourney'
import { getEarthLandmark } from './earthLandmarks'

export interface EarthPassengerArrivalNode extends PassengerArrivalNode {
  accessKind: 'landmark-site-anchor'
  locator: {
    kind: 'address'
    value: string
  }
  /** Address/site precision only. Never treat this as an entrance coordinate. */
  precision: 'site'
}

/**
 * Creates a stable site-level arrival identity from the canonical landmark registry.
 * The locator remains the landmark's geocodable address/place label; no guessed lat/lon
 * or visitor entrance is introduced. World routing must resolve a routeable point later.
 */
export function getEarthLandmarkArrivalNode(landmarkId: string): EarthPassengerArrivalNode | null {
  const landmark = getEarthLandmark(landmarkId)
  if (!landmark) return null

  return {
    id: `earth-arrival:${landmark.id}:site`,
    worldId: 'earth',
    worldObject: { kind: 'earth-landmark', id: landmark.id },
    authority: 'canonical-world-registry',
    accessKind: 'landmark-site-anchor',
    locator: { ...landmark.locator },
    precision: 'site',
  }
}
