import { describe, expect, it } from 'vitest'
import { facilityPortToward, suggestEarthFacilityRoadAccess, earthRoadAccessCostCredits } from './earthAccess'
import type { ImportedEarthFeature } from '@/lib/world/spatial/earthFeatureSource'
import { localMetersToGeo } from '@/lib/world/spatial/earthSpatial'

const origin = { lat: 51.33745, lon: 7.97975 }

function roadFeature(points: Array<{ xM: number; yM: number }>): ImportedEarthFeature {
  return {
    id: 'osm:road:test',
    worldId: 'earth',
    featureType: 'road',
    geometryKind: 'line',
    properties: { highway: 'service' },
    geometry: {
      kind: 'line',
      coordinates: points.map(point => localMetersToGeo({ eastM: point.xM, northM: point.yM }, origin)),
    },
    source: { provider: 'test', dataset: 'test', sourceId: 'road-test' },
  }
}

describe('Earth facility road access', () => {
  it('places the facility port on the footprint edge toward the road', () => {
    expect(facilityPortToward({ xM: 0, yM: 0 }, { xM: 100, yM: 0 }, 20, 10, 0)).toEqual({ xM: 10, yM: 0 })
  })

  it('respects building rotation when choosing an edge port', () => {
    const port = facilityPortToward({ xM: 0, yM: 0 }, { xM: 0, yM: 100 }, 20, 10, 90)
    expect(port.xM).toBeCloseTo(0, 6)
    expect(port.yM).toBeCloseTo(10, 6)
  })

  it('connects a building edge to the nearest observed road segment', () => {
    const suggestion = suggestEarthFacilityRoadAccess({
      origin,
      entityCenter: { xM: 0, yM: 0 },
      footprintWidthM: 20,
      footprintDepthM: 10,
      rotationDeg: 0,
      roadFeatures: [roadFeature([{ xM: 40, yM: -100 }, { xM: 40, yM: 100 }])],
    })

    expect(suggestion).not.toBeNull()
    expect(suggestion?.facilityPort.xM).toBeCloseTo(10, 1)
    expect(suggestion?.roadTieIn.xM).toBeCloseTo(40, 1)
    expect(suggestion?.lengthM).toBeCloseTo(30, 1)
    expect(suggestion?.roadFeatureId).toBe('osm:road:test')
  })

  it('uses length-based construction pricing', () => {
    expect(earthRoadAccessCostCredits(0)).toBe(250)
    expect(earthRoadAccessCostCredits(50)).toBe(600)
  })
})
