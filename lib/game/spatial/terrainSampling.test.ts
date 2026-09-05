import type { TerrainDatasetDescriptor, WorldFrame } from './types'
import {
  assertTerrainSamplingReady,
  sampleTerrainFootprint,
  type TerrainSampler,
} from './terrainSampling'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const frame: WorldFrame = {
  locationId: 'test-location',
  body: 'mars',
  coordinateSystem: 'LOCAL_ENU_METERS',
  originLatDeg: -4.5,
  originLonDeg: 137.4,
  originAltM: 0,
  originStatus: 'verified',
  terrainDatasetId: 'test-dem',
  worldSeed: 'TEST',
}

const dataset: TerrainDatasetDescriptor = {
  id: 'test-dem',
  body: 'mars',
  provider: 'test',
  datasetName: 'deterministic fixture',
  datasetKind: 'dem',
  horizontalReference: 'TEST',
  verticalReference: 'TEST_DATUM',
  latitudeType: 'planetocentric',
  longitudeDirection: 'positive_east',
  sourceUri: 'fixture://terrain',
  accessMode: 'fixture',
  status: 'ready',
}

assertTerrainSamplingReady({ frame, dataset })

let rejectedPendingOrigin = false
try {
  assertTerrainSamplingReady({ frame: { ...frame, originStatus: 'pending' }, dataset })
} catch {
  rejectedPendingOrigin = true
}
assert(rejectedPendingOrigin, 'pending origins must not be terrain-sampled')

let rejectedPendingDataset = false
try {
  assertTerrainSamplingReady({ frame, dataset: { ...dataset, status: 'catalogued' } })
} catch {
  rejectedPendingDataset = true
}
assert(rejectedPendingDataset, 'catalogued-only datasets must not be terrain-sampled')

const sampler: TerrainSampler = {
  async sampleTerrainHeight(context, point) {
    return {
      ...point,
      zM: 10 + point.xM * 0.01 + point.yM * 0.02,
      datasetId: context.dataset.id,
      sourceElevationM: 1000 + point.xM * 0.01 + point.yM * 0.02,
      verticalReference: context.dataset.verticalReference,
    }
  },
}

const resolved = await sampleTerrainFootprint(
  sampler,
  { frame, dataset },
  { xM: 100, yM: 200, zM: null, widthM: 60, depthM: 40, rotationDeg: 15 },
)
assert(resolved !== null, 'complete observed footprint must resolve')
assert(resolved!.samples.length === 9, 'footprint resolution must sample all canonical points')
assert(resolved!.summary.reliefM > 0, 'sloped fixture must produce relief')

let sampleIndex = 0
const noDataSampler: TerrainSampler = {
  async sampleTerrainHeight(context, point) {
    sampleIndex += 1
    if (sampleIndex === 3) return null
    return {
      ...point,
      zM: 1,
      datasetId: context.dataset.id,
      sourceElevationM: 1,
      verticalReference: context.dataset.verticalReference,
    }
  },
}
const unresolved = await sampleTerrainFootprint(
  noDataSampler,
  { frame, dataset },
  { xM: 0, yM: 0, zM: null, widthM: 10, depthM: 10 },
)
assert(unresolved === null, 'partial/NoData footprint must stay unresolved')

console.log('terrain sampling contract tests passed')
