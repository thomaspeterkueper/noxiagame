import { strict as assert } from 'node:assert'
import { MARS_MOLA_DATASET } from './molaTerrainAdapter'
import { CachedMarsMolaAdapter } from './marsTerrainIngestion'
import { TerrainTileCatalogue } from './terrainTileCatalogue'
import type { TerrainRasterTileManifest } from './terrainRaster'
import type { WorldFrame } from './types'

async function main() {
  const manifest: TerrainRasterTileManifest = {
    datasetId: MARS_MOLA_DATASET.id,
    tileKey: 'tharsis-mola-001',
    minLatDeg: 10,
    minLonDeg: -110,
    maxLatDeg: 20,
    maxLonDeg: -90,
    rasterWidth: 100,
    rasterHeight: 100,
    pixelSizeM: 463.0836,
    storageBucket: 'terrain',
    storagePath: 'mars/mola/tharsis-mola-001.tif',
    rasterFormat: 'geotiff',
    checksum: 'a'.repeat(64),
    checksumAlgorithm: 'sha256',
    byteSize: 4096,
    status: 'catalogued',
  }

  const catalogue = new TerrainTileCatalogue({ async validate() {} })
  catalogue.catalogue(manifest)

  const frame: WorldFrame = {
    locationId: 'mars-tharsis',
    body: 'mars',
    coordinateSystem: 'LOCAL_ENU_METERS',
    originLatDeg: 14,
    originLonDeg: -102,
    originAltM: 1500,
    originStatus: 'verified',
    referenceFrame: 'IAU_MARS_ELLIPSOID',
    latitudeType: 'planetocentric',
    longitudeDirection: 'positive_east',
    equatorialRadiusM: 3396190,
    polarRadiusM: 3376200,
    verticalDatum: 'MOLA_GMM2B_AREOID',
    terrainDatasetId: MARS_MOLA_DATASET.id,
    worldSeed: 'MARS:THARSIS',
  }

  let openedUri = ''
  const adapter = new CachedMarsMolaAdapter(catalogue, async uri => {
    openedUri = uri
    return {
      getWidth: () => 100,
      getHeight: () => 100,
      getBoundingBox: () => [-110, 10, -90, 20] as [number, number, number, number],
      getGDALNoData: () => -32768,
      async readRasters() { return new Int16Array([1750]) },
    }
  })

  const pending = await adapter.sampleAtPlanetary(
    { ...MARS_MOLA_DATASET, status: 'ready' },
    frame,
    { latDeg: 14, lonDeg: -102 },
  )
  assert.equal(pending, null, 'catalogued but unvalidated coverage must remain unresolved')

  await catalogue.ingest(manifest.tileKey)
  const sample = await adapter.sampleAtPlanetary(
    { ...MARS_MOLA_DATASET, status: 'ready' },
    frame,
    { latDeg: 14, lonDeg: 258 },
  )
  assert.ok(sample)
  assert.equal(sample.sourceElevationM, 1750)
  assert.equal(sample.localUpM, 250)
  assert.equal(sample.tileKey, manifest.tileKey)
  assert.equal(openedUri, 'terrain://terrain/mars/mola/tharsis-mola-001.tif')

  const missing = await adapter.sampleAtPlanetary(
    { ...MARS_MOLA_DATASET, status: 'ready' },
    frame,
    { latDeg: 30, lonDeg: -102 },
  )
  assert.equal(missing, null, 'missing cached Mars coverage must remain unresolved')

  console.log('Mars cached terrain ingestion tests passed')
}

void main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
