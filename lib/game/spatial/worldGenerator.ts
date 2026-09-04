import type { SpatialFrame, SpatialLayer } from './types'

export type HeightSample = { xM: number; yM: number; elevationM: number }
export type TerrainCell = { xM: number; yM: number; slope: number; moisture: number; buildability: number }
export type GeneratedWorld = {
  frame: SpatialFrame
  observed: SpatialLayer<{ heights: HeightSample[] }>
  derived: SpatialLayer<{ terrain: TerrainCell[] }>
  simulated: SpatialLayer<{ seed: number }>
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function deriveTerrain(heights: HeightSample[], resolutionM = 100): TerrainCell[] {
  const byKey = new Map(heights.map(h => [`${h.xM}:${h.yM}`, h]))
  return heights.map(h => {
    const east = byKey.get(`${h.xM + resolutionM}:${h.yM}`)
    const south = byKey.get(`${h.xM}:${h.yM + resolutionM}`)
    const dx = east ? (east.elevationM - h.elevationM) / resolutionM : 0
    const dy = south ? (south.elevationM - h.elevationM) / resolutionM : 0
    const slope = Math.sqrt(dx * dx + dy * dy)
    return {
      xM: h.xM,
      yM: h.yM,
      slope,
      moisture: 0,
      buildability: Math.max(0, Math.min(1, 1 - slope * 8)),
    }
  })
}

export function generateWorld(frame: SpatialFrame, observedHeights: HeightSample[], source: string): GeneratedWorld {
  const random = mulberry32(frame.canonicalSeed)
  const terrain = deriveTerrain(observedHeights).map(cell => ({
    ...cell,
    moisture: random(),
  }))

  return {
    frame,
    observed: {
      provenance: 'observed',
      source,
      payload: { heights: observedHeights },
    },
    derived: {
      provenance: 'derived',
      source: 'NOXIA spatial derivation v1',
      payload: { terrain },
    },
    simulated: {
      provenance: 'simulated',
      source: 'NOXIA canonical seed',
      payload: { seed: frame.canonicalSeed },
    },
  }
}
