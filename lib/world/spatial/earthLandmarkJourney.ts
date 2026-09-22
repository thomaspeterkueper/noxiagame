import { getEarthLandmark } from './earthLandmarks'

/**
 * Client/world-side destination intent for a future passenger journey.
 *
 * A landmark journey targets a stable world object reference, never a UI map
 * coordinate. Core/Earth must resolve the canonical arrival node immediately
 * before a journey draft can become authoritative.
 */
export type EarthLandmarkJourneyTarget = {
  worldObject: {
    kind: 'earth-landmark'
    id: string
  }
  arrival: {
    mode: 'resolve-canonical-arrival-node'
    nodeId: null
    authority: 'server-required'
  }
  immersiveHandoff: {
    mode: 'after-arrival'
    spaceId: null
    authority: 'world-object-required'
  }
}

export function buildEarthLandmarkJourneyTarget(landmarkId: string): EarthLandmarkJourneyTarget {
  const landmark = getEarthLandmark(landmarkId)
  if (!landmark) throw new Error(`Unknown Earth landmark: ${landmarkId}`)

  return {
    worldObject: {
      kind: 'earth-landmark',
      id: landmark.id,
    },
    arrival: {
      mode: 'resolve-canonical-arrival-node',
      nodeId: null,
      authority: 'server-required',
    },
    immersiveHandoff: {
      mode: 'after-arrival',
      spaceId: null,
      authority: 'world-object-required',
    },
  }
}
