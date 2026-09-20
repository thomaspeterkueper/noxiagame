import { describe, expect, it } from 'vitest'
import {
  assertCompatibleConnection,
  createInfrastructureEdge,
  isLegacyGridLinearBuildable,
  normalizeInfrastructureGeometry,
  polylineLengthM,
  type InfrastructureNode,
} from './network'

describe('geospatial infrastructure network', () => {
  it('keeps the legacy grid road out of footprint-based geospatial construction', () => {
    expect(isLegacyGridLinearBuildable('road')).toBe(true)
    expect(isLegacyGridLinearBuildable('laboratory')).toBe(false)
  })

  it('measures a metric polyline instead of treating a route as a tile', () => {
    expect(polylineLengthM([
      { xM: 0, yM: 0 },
      { xM: 30, yM: 40 },
      { xM: 30, yM: 50 },
    ])).toBeCloseTo(60)
  })

  it('removes duplicate points and rejects degenerate geometry', () => {
    expect(normalizeInfrastructureGeometry([
      { xM: 10, yM: 20 },
      { xM: 10, yM: 20 },
      { xM: 13, yM: 24 },
    ])).toEqual([
      { xM: 10, yM: 20 },
      { xM: 13, yM: 24 },
    ])

    expect(() => normalizeInfrastructureGeometry([
      { xM: 10, yM: 20 },
      { xM: 10, yM: 20 },
    ])).toThrow(/measurable distance/i)
  })

  it('creates an edge with computed length and persistent polyline geometry', () => {
    const edge = createInfrastructureEdge({
      id: 'edge-1',
      locationId: 'earth',
      networkType: 'road',
      source: 'player-built',
      status: 'planned',
      startNodeId: 'gate',
      endNodeId: 'osm-tie-in',
      geometry: [
        { xM: 100, yM: 200 },
        { xM: 130, yM: 240 },
      ],
      ownerProfileId: 'player-1',
    })

    expect(edge.lengthM).toBeCloseTo(50)
    expect(edge.geometry).toHaveLength(2)
  })

  it('does not silently connect incompatible utility networks', () => {
    const roadNode: InfrastructureNode = {
      id: 'road-node', locationId: 'earth', networkType: 'road', kind: 'junction',
      point: { xM: 0, yM: 0 }, source: 'observed',
    }
    const railNode: InfrastructureNode = {
      id: 'rail-node', locationId: 'earth', networkType: 'rail', kind: 'junction',
      point: { xM: 10, yM: 0 }, source: 'observed',
    }

    expect(() => assertCompatibleConnection('road', roadNode, railNode)).toThrow(/network mismatch/i)
  })
})
