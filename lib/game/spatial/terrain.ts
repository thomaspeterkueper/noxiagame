import type { Footprint, TerrainFootprintSummary, TerrainHeightSample } from './types'

const DEG = Math.PI / 180

export function footprintSamplePoints(footprint: Footprint) {
  const angle = (footprint.rotationDeg ?? 0) * DEG
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const halfW = footprint.widthM / 2
  const halfD = footprint.depthM / 2
  const localPoints = [
    [0, 0],
    [-halfW, -halfD], [halfW, -halfD], [halfW, halfD], [-halfW, halfD],
    [0, -halfD], [halfW, 0], [0, halfD], [-halfW, 0],
  ] as const

  return localPoints.map(([dx, dy]) => ({
    xM: footprint.xM + dx * cos - dy * sin,
    yM: footprint.yM + dx * sin + dy * cos,
  }))
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

export function summarizeTerrainFootprint(samples: TerrainHeightSample[]): TerrainFootprintSummary {
  if (samples.length === 0) throw new Error('At least one terrain height sample is required')

  const center = samples[0]
  const heights = samples.map(sample => sample.zM)
  const minZM = Math.min(...heights)
  const maxZM = Math.max(...heights)
  const meanZM = heights.reduce((sum, value) => sum + value, 0) / heights.length

  let maxSlopeDeg = 0
  for (const sample of samples.slice(1)) {
    const horizontal = Math.hypot(sample.xM - center.xM, sample.yM - center.yM)
    if (horizontal <= 0) continue
    const slope = Math.atan(Math.abs(sample.zM - center.zM) / horizontal) / DEG
    maxSlopeDeg = Math.max(maxSlopeDeg, slope)
  }

  return {
    centerZM: center.zM,
    minZM,
    maxZM,
    meanZM,
    foundationZM: median(heights),
    reliefM: maxZM - minZM,
    maxSlopeDeg,
    sampleCount: samples.length,
  }
}
