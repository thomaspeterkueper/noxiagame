import { LolaTerrainAdapter } from './lolaTerrainAdapter'
import type { TerrainDatasetDescriptor, WorldFrame } from './types'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function near(actual: number, expected: number, tolerance: number, label: string) {
  assert(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}, got ${actual}`)
}

const frame: WorldFrame = {
  locationId: 'moon-test',
  body: 'moon',
  coordinateSystem: 'LOCAL_ENU_METERS',
  originLatDeg: -89.67,
  originLonDeg: 129.78,
  originAltM: 0,
  originStatus: 'verified',
  referenceFrame: 'IAU_MOON_MEAN_SPHERE',
  latitudeType: 'planetocentric',
  longitudeDirection: 'positive_east',
  equatorialRadiusM: 1737400,
  polarRadiusM: 1737400,
  verticalDatum: 'MEAN_RADIUS_1737400_M',
  terrainDatasetId: 'moon_lro_lola_118m',
  worldSeed: 'TEST:MOON',
}

const dataset: TerrainDatasetDescriptor = {
  id: 'moon_lro_lola_118m',
  body: 'moon',
  provider: 'USGS Astrogeology / NASA LRO',
  datasetName: 'Moon LRO LOLA Global LDEM 118m',
  datasetVersion: '2014-03-11',
  datasetKind: 'dem',
  resolutionM: 118.4505876,
  horizontalReference: 'MOON_MEAN_EARTH_POLAR_AXIS',
  verticalReference: 'MEAN_RADIUS_1737400_M',
  latitudeType: 'planetocentric',
  longitudeDirection: 'positive_east',
  sourceUri: 'https://example.invalid/lola.tif',
  accessMode: 'geotiff',
  status: 'ready',
  metadata: { stored_scale: 0.5, stored_offset: 0 },
}

let readWindow: [number, number, number, number] | null = null
const adapter = new LolaTerrainAdapter(async () => ({
  getWidth: () => 92160,
  getHeight: () => 46080,
  getBoundingBox: () => [-180, -90, 180, 90],
  getGDALNoData: () => -32768,
  async readRasters(options) {
    readWindow = options.window
    return new Int16Array([2000])
  },
}))

const sample = await adapter.sampleAtPlanetary(dataset, frame, {
  latDeg: frame.originLatDeg!,
  lonDeg: frame.originLonDeg!,
  elevationM: 0,
})
assert(sample !== null, 'LOLA adapter must resolve valid source sample')
near(sample!.sourceElevationM, 1000, 1e-9, 'LOLA stored scale')
near(sample!.localUpM, 1000, 0.01, 'LOLA origin local Up')
assert(readWindow !== null, 'LOLA adapter must read exactly one pixel window')
assert(readWindow![2] - readWindow![0] === 1 && readWindow![3] - readWindow![1] === 1, 'LOLA read must be a 1x1 source window')

const noDataAdapter = new LolaTerrainAdapter(async () => ({
  getWidth: () => 92160,
  getHeight: () => 46080,
  getBoundingBox: () => [-180, -90, 180, 90],
  getGDALNoData: () => -32768,
  async readRasters() {
    return new Int16Array([-32768])
  },
}))
const noData = await noDataAdapter.sampleAtPlanetary(dataset, frame, {
  latDeg: -89.5,
  lonDeg: 120,
})
assert(noData === null, 'LOLA NoData must remain unresolved')

console.log('LOLA terrain adapter tests passed')
