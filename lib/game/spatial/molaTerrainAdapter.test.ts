import { MARS_MOLA_DATASET, MolaTerrainAdapter } from './molaTerrainAdapter'
import type { WorldFrame } from './types'

async function main() {
  function assert(condition: boolean, message: string) {
    if (!condition) throw new Error(message)
  }

  function near(actual: number, expected: number, tolerance: number, label: string) {
    assert(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}, got ${actual}`)
  }

  const frame: WorldFrame = {
    locationId: 'mars-tharsis-test',
    body: 'mars',
    coordinateSystem: 'LOCAL_ENU_METERS',
    originLatDeg: 0,
    originLonDeg: -112.5,
    originAltM: 0,
    originStatus: 'verified',
    referenceFrame: 'IAU_MARS_ELLIPSOID',
    latitudeType: 'planetocentric',
    longitudeDirection: 'positive_east',
    equatorialRadiusM: 3396190,
    polarRadiusM: 3376200,
    verticalDatum: 'MOLA_AREOID',
    terrainDatasetId: MARS_MOLA_DATASET.id,
    worldSeed: 'TEST:MARS:THARSIS',
  }

  let readWindow: [number, number, number, number] | null = null
  const adapter = new MolaTerrainAdapter(async () => ({
    getWidth: () => 46080,
    getHeight: () => 23040,
    getBoundingBox: () => [-180, -90, 180, 90],
    getGDALNoData: () => -32768,
    async readRasters(options) {
      readWindow = options.window
      return new Int16Array([1750])
    },
  }))

  const sample = await adapter.sampleAtPlanetary(MARS_MOLA_DATASET, frame, {
    latDeg: 0,
    lonDeg: -112.5,
    elevationM: 0,
  })
  assert(sample !== null, 'MOLA adapter must resolve valid source sample')
  near(sample!.sourceElevationM, 1750, 1e-9, 'MOLA elevation')
  near(sample!.localUpM, 1750, 0.02, 'MOLA origin local Up')
  assert(readWindow !== null, 'MOLA adapter must read one pixel window')
  assert(readWindow![2] - readWindow![0] === 1 && readWindow![3] - readWindow![1] === 1, 'MOLA read must be 1x1')

  const wrapAdapter = new MolaTerrainAdapter(async () => ({
    getWidth: () => 360,
    getHeight: () => 180,
    getBoundingBox: () => [-180, -90, 180, 90],
    async readRasters(options) {
      readWindow = options.window
      return new Int16Array([0])
    },
  }))
  await wrapAdapter.sampleAtPlanetary(MARS_MOLA_DATASET, frame, { latDeg: 0, lonDeg: 247.5 })
  assert(readWindow !== null && readWindow![0] === 67, 'MOLA longitudes must normalize into -180..180 positive-east domain')

  const noDataAdapter = new MolaTerrainAdapter(async () => ({
    getWidth: () => 46080,
    getHeight: () => 23040,
    getBoundingBox: () => [-180, -90, 180, 90],
    getGDALNoData: () => -32768,
    async readRasters() { return new Int16Array([-32768]) },
  }))
  const noData = await noDataAdapter.sampleAtPlanetary(MARS_MOLA_DATASET, frame, { latDeg: 5, lonDeg: 10 })
  assert(noData === null, 'MOLA NoData must remain unresolved')

  console.log('MOLA terrain adapter tests passed')
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
