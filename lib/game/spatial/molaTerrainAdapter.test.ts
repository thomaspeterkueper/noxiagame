import { strict as assert } from 'node:assert'
import { MARS_MOLA_DATASET, MolaTerrainAdapter } from './molaTerrainAdapter'
import type { WorldFrame } from './types'

async function main() {
  const nativeFrame: WorldFrame = {
    locationId: 'mars-test',
    body: 'mars',
    coordinateSystem: 'LOCAL_ENU_METERS',
    originLatDeg: 10,
    originLonDeg: 20,
    originAltM: 1500,
    originStatus: 'verified',
    referenceFrame: 'IAU_MARS_ELLIPSOID',
    latitudeType: 'planetocentric',
    longitudeDirection: 'positive_east',
    equatorialRadiusM: 3396190,
    polarRadiusM: 3376200,
    verticalDatum: 'MOLA_GMM2B_AREOID',
    terrainDatasetId: MARS_MOLA_DATASET.id,
    worldSeed: 'TEST:MARS',
  }

  let readWindow: [number, number, number, number] | null = null
  const opener = async () => ({
    getWidth: () => 46080,
    getHeight: () => 23040,
    getBoundingBox: () => [-180, -90, 180, 90] as [number, number, number, number],
    getGDALNoData: () => -32768,
    async readRasters(options: { window: [number, number, number, number] }) {
      readWindow = options.window
      return new Int16Array([1750])
    },
  })

  const native = await new MolaTerrainAdapter(opener).sampleAtPlanetary(
    { ...MARS_MOLA_DATASET, status: 'ready' },
    nativeFrame,
    { latDeg: 10, lonDeg: 20 },
  )
  assert.ok(native)
  assert.equal(native.sourceElevationM, 1750)
  assert.equal(native.localUpM, 250, 'native areoid elevation must be relative to the frame origin in the same datum')
  assert.ok(readWindow && readWindow[2] - readWindow[0] === 1 && readWindow[3] - readWindow[1] === 1)

  const ellipsoidFrame: WorldFrame = {
    ...nativeFrame,
    originAltM: 0,
    verticalDatum: 'IAU_MARS_REFERENCE_ELLIPSOID',
  }
  const unresolved = await new MolaTerrainAdapter(opener).sampleAtPlanetary(
    MARS_MOLA_DATASET,
    ellipsoidFrame,
    { latDeg: 10, lonDeg: 20 },
  )
  assert.equal(unresolved, null, 'different vertical datums still require an explicit conversion')

  const converted = await new MolaTerrainAdapter(opener, sourceElevationM => sourceElevationM).sampleAtPlanetary(
    { ...MARS_MOLA_DATASET, status: 'ready' },
    ellipsoidFrame,
    { latDeg: 10, lonDeg: 20 },
  )
  assert.ok(converted)
  assert.equal(converted.sourceElevationM, 1750)
  assert.ok(Math.abs(converted.localUpM - 1750) < .02)

  const noDataAdapter = new MolaTerrainAdapter(async () => ({
    getWidth: () => 360,
    getHeight: () => 180,
    getBoundingBox: () => [-180, -90, 180, 90] as [number, number, number, number],
    getGDALNoData: () => -32768,
    async readRasters() { return new Int16Array([-32768]) },
  }))
  const noData = await noDataAdapter.sampleAtPlanetary(
    { ...MARS_MOLA_DATASET, status: 'ready' },
    nativeFrame,
    { latDeg: 0, lonDeg: 0 },
  )
  assert.equal(noData, null)

  assert.equal(MARS_MOLA_DATASET.id, 'mars_mgs_mola_463m')
  assert.equal(MARS_MOLA_DATASET.status, 'catalogued')
  assert.equal(MARS_MOLA_DATASET.verticalReference, 'MOLA_GMM2B_AREOID')
  assert.equal(MARS_MOLA_DATASET.metadata?.latitude_type, 'planetocentric')
  assert.equal(MARS_MOLA_DATASET.metadata?.longitude_direction, 'positive_east')
  console.log('MOLA terrain adapter tests passed')
}

void main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
