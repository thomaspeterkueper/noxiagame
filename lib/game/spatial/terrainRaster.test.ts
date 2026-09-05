import type { TerrainDatasetDescriptor, WorldFrame } from './types'
import {
  RasterTerrainSampler,
  selectTerrainRasterAdapter,
  validateTerrainTileManifest,
  type TerrainRasterAdapter,
} from './terrainRaster'

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
  referenceFrame: 'IAU_MARS_ELLIPSOID',
  latitudeType: 'planetocentric',
  longitudeDirection: 'positive_east',
  equatorialRadiusM: 3396190,
  polarRadiusM: 3376200,
  verticalDatum: 'IAU_MARS_REFERENCE_ELLIPSOID',
  terrainDatasetId: 'mars-fixture',
  worldSeed: 'TEST',
}

const dataset: TerrainDatasetDescriptor = {
  id: 'mars-fixture',
  body: 'mars',
  provider: 'fixture',
  datasetName: 'fixture DEM',
  datasetKind: 'dem',
  horizontalReference: 'IAU_MARS_PLANETOCENTRIC',
  verticalReference: 'MOLA_FIXTURE_AREOID',
  latitudeType: 'planetocentric',
  longitudeDirection: 'positive_east',
  sourceUri: 'fixture://mars-dem',
  accessMode: 'fixture',
  status: 'ready',
}

validateTerrainTileManifest({
  datasetId: dataset.id,
  tileKey: 'tile-001',
  minLatDeg: -5,
  minLonDeg: 137,
  maxLatDeg: -4,
  maxLonDeg: 138,
  rasterWidth: 32,
  rasterHeight: 32,
  storageBucket: 'terrain',
  storagePath: 'mars-fixture/tile-001.tif',
  rasterFormat: 'geotiff',
  checksum: 'a'.repeat(64),
  checksumAlgorithm: 'sha256',
  byteSize: 4096,
  status: 'ready',
})

let rejectedBadChecksum = false
try {
  validateTerrainTileManifest({
    datasetId: dataset.id,
    tileKey: 'broken',
    minLatDeg: 0,
    minLonDeg: 0,
    maxLatDeg: 1,
    maxLonDeg: 1,
    rasterWidth: 1,
    rasterHeight: 1,
    storageBucket: 'terrain',
    storagePath: 'broken.tif',
    rasterFormat: 'geotiff',
    checksum: 'bad',
    checksumAlgorithm: 'sha256',
    byteSize: 1,
    status: 'ready',
  })
} catch {
  rejectedBadChecksum = true
}
assert(rejectedBadChecksum, 'ingestion manifest must require SHA-256')

const adapter: TerrainRasterAdapter = {
  id: 'fixture-adapter',
  supports(candidate) {
    return candidate.id === dataset.id
  },
  async sampleAtPlanetary(candidate, _frame, coordinate) {
    return {
      sourceElevationM: 1000 + coordinate.latDeg,
      localUpM: 12.5,
      tileKey: `${candidate.id}:fixture`,
    }
  },
}

assert(selectTerrainRasterAdapter([adapter], dataset) === adapter, 'dataset must select exactly one adapter')

const sampler = new RasterTerrainSampler([adapter])
const sample = await sampler.sampleTerrainHeight({ frame, dataset }, { xM: 0, yM: 0 })
assert(sample !== null, 'raster sampler must resolve supported terrain')
assert(sample!.zM === 12.5, 'canonical z must come from adapter localUpM')
assert(sample!.sourceElevationM !== sample!.zM, 'source elevation and local Up must stay distinct')
assert(sample!.verticalReference === dataset.verticalReference, 'vertical datum provenance must be preserved')

console.log('terrain raster adapter tests passed')
