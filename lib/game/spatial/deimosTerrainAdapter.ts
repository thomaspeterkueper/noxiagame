import { planetaryToLocalWorld } from './planetary'
import type { PlanetaryCoordinate, TerrainDatasetDescriptor, WorldFrame } from './types'
import type { TerrainRasterAdapter, TerrainRasterSourceSample } from './terrainRaster'

// Deimos currently has no raster DEM in the NOXIA terrain pipeline. This
// adapter therefore provides an explicitly synthetic, deterministic heightfield
// so a future playable surface can use the common terrain stack without
// pretending that invented elevations are observations.
const DEIMOS_MEAN_RADIUS_M = 6200

type NamedCraterSeed = {
  name: string
  latDeg: number
  lonDeg: number
  diameterKm: number
  inventedDepthM: number
}

// Named-feature positions are reference anchors; depth/profile are deliberately
// invented for gameplay legibility and remain marked as synthetic metadata.
const NAMED_CRATERS: readonly NamedCraterSeed[] = [
  { name: 'Voltaire', latDeg: 22.0, lonDeg: -3.5, diameterKm: 3.0, inventedDepthM: 260 },
  { name: 'Swift', latDeg: 12.5, lonDeg: 1.8, diameterKm: 3.0, inventedDepthM: 240 },
]

function normalizeLongitude(lonDeg: number) {
  const normalized = ((lonDeg + 180) % 360 + 360) % 360 - 180
  return normalized === -180 ? 180 : normalized
}

function greatCircleDistanceM(lat1: number, lon1: number, lat2: number, lon2: number, radiusM: number) {
  const toRad = (deg: number) => deg * Math.PI / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(normalizeLongitude(lon2 - lon1))
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * radiusM * Math.asin(Math.min(1, Math.sqrt(a)))
}

function hash2(ix: number, iy: number) {
  const value = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453123
  return value - Math.floor(value)
}

function smoothNoise(x: number, y: number) {
  const x0 = Math.floor(x), y0 = Math.floor(y)
  const fx = x - x0, fy = y - y0
  const v00 = hash2(x0, y0), v10 = hash2(x0 + 1, y0)
  const v01 = hash2(x0, y0 + 1), v11 = hash2(x0 + 1, y0 + 1)
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy)
  return (v00 * (1 - sx) + v10 * sx) * (1 - sy) + (v01 * (1 - sx) + v11 * sx) * sy
}

function fbmElevation(latDeg: number, lonDeg: number) {
  const u = (normalizeLongitude(lonDeg) + 180) / 360 * 8
  const v = (latDeg + 90) / 180 * 8
  let amplitude = 90, frequency = 1, sum = 0
  for (let octave = 0; octave < 3; octave++) {
    sum += (smoothNoise(u * frequency, v * frequency) * 2 - 1) * amplitude
    amplitude *= 0.5
    frequency *= 2
  }
  return sum
}

export function syntheticDeimosElevationM(latDeg: number, lonDeg: number): number {
  let elevation = fbmElevation(latDeg, lonDeg)
  for (const crater of NAMED_CRATERS) {
    const distanceM = greatCircleDistanceM(latDeg, lonDeg, crater.latDeg, crater.lonDeg, DEIMOS_MEAN_RADIUS_M)
    const radiusM = crater.diameterKm * 500
    if (distanceM >= radiusM) continue
    const bowl = Math.cos((distanceM / radiusM) * Math.PI / 2) ** 2
    elevation -= crater.inventedDepthM * bowl
  }
  return elevation
}

export class DeimosSyntheticTerrainAdapter implements TerrainRasterAdapter {
  readonly id = 'deimos-synthetic-v1'

  supports(dataset: TerrainDatasetDescriptor) {
    return dataset.id === DEIMOS_SYNTHETIC_DATASET.id
  }

  async sampleAtPlanetary(
    dataset: TerrainDatasetDescriptor,
    frame: WorldFrame,
    coordinate: PlanetaryCoordinate,
  ): Promise<TerrainRasterSourceSample | null> {
    if (!this.supports(dataset)) return null
    const sourceElevationM = syntheticDeimosElevationM(coordinate.latDeg, coordinate.lonDeg)
    const tileKey = `synthetic:${dataset.id}`

    if (frame.verticalDatum === dataset.verticalReference) {
      if (frame.originAltM == null || !Number.isFinite(frame.originAltM)) return null
      return { sourceElevationM, localUpM: sourceElevationM - frame.originAltM, tileKey }
    }

    const local = planetaryToLocalWorld(
      { latDeg: coordinate.latDeg, lonDeg: coordinate.lonDeg, elevationM: sourceElevationM },
      frame,
    )
    if (!local) return null
    return { sourceElevationM, localUpM: local.zM, tileKey }
  }
}

export const DEIMOS_SYNTHETIC_DATASET: TerrainDatasetDescriptor = {
  id: 'deimos_synthetic_v1',
  body: 'deimos',
  provider: 'NOXIA (synthetic; not an observed DEM)',
  datasetName: 'Deimos Synthetic Low-Relief Heightfield v1',
  datasetVersion: '2026-09-25',
  datasetKind: 'dem',
  resolutionM: null,
  horizontalReference: 'DEIMOS_PLANETOCENTRIC',
  verticalReference: 'DEIMOS_MEAN_RADIUS_6200M',
  latitudeType: 'planetocentric',
  longitudeDirection: 'positive_east',
  sourceUri: 'synthetic://deimos/fbm-v1',
  sourceLicense: 'n/a (procedurally generated, not an observation)',
  accessMode: 'synthetic-procedural',
  status: 'ready',
  metadata: {
    provenance: 'synthetic',
    generator: 'deimosTerrainAdapter.syntheticDeimosElevationM',
    real_reference_features: ['Voltaire', 'Swift'],
    real_reference_note: 'Named-feature positions are reference anchors; crater depth/profile are invented for gameplay and are not observations.',
    adopted_mean_radius_m: DEIMOS_MEAN_RADIUS_M,
    invented_at: '2026-09-25',
  },
}
