import { CachedShackletonLolaAdapter, ShackletonTerrainIngestion } from './shackletonTerrainIngestion'
import type { TerrainRasterTileManifest } from './terrainRaster'
import type { TerrainDatasetDescriptor, WorldFrame } from './types'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const manifest = (tileKey: string, checksum = 'a'.repeat(64)): TerrainRasterTileManifest => ({
  datasetId: 'moon_lro_lola_118m',
  tileKey,
  minLatDeg: -90,
  minLonDeg: 120,
  maxLatDeg: -89,
  maxLonDeg: 140,
  rasterWidth: 100,
  rasterHeight: 100,
  storageBucket: 'terrain',
  storagePath: `moon/lola/${tileKey}.tif`,
  rasterFormat: 'geotiff',
  checksum,
  checksumAlgorithm: 'sha256',
  byteSize: 4096,
  status: 'catalogued',
})

const validated: string[] = []
const ingestion = new ShackletonTerrainIngestion({
  async validate(tile) {
    validated.push(tile.tileKey)
    if (tile.tileKey === 'bad') throw new Error('checksum mismatch')
  },
})

const pending = ingestion.catalogue(manifest('shackleton-001'))
assert(pending.state === 'pending', 'catalogued tile must begin pending')
assert(ingestion.readyTileAt({ latDeg: -89.67, lonDeg: 129.78 }) === null, 'pending coverage must stay unresolved')

const ready = await ingestion.ingest('shackleton-001')
assert(ready.state === 'ready', 'validated tile must become ready')
assert(ready.manifest.status === 'ready', 'ready ingestion must publish ready manifest')
assert(validated.includes('shackleton-001'), 'byte/checksum validator must run before publication')

ingestion.catalogue(manifest('bad'))
const invalid = await ingestion.ingest('bad')
assert(invalid.state === 'invalid', 'failed validation must mark tile invalid')
assert(invalid.manifest.status === 'failed', 'invalid tile must never publish ready status')

let openedUri = ''
const adapter = new CachedShackletonLolaAdapter(ingestion, async uri => {
  openedUri = uri
  return {
    getWidth: () => 100,
    getHeight: () => 100,
    getBoundingBox: () => [120, -90, 140, -89],
    getGDALNoData: () => -32768,
    async readRasters() {
      return new Int16Array([2000])
    },
  }
})

const frame: WorldFrame = {
  locationId: 'moon-shackleton',
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
  worldSeed: 'MOON:SHACKLETON',
}
const dataset: TerrainDatasetDescriptor = {
  id: 'moon_lro_lola_118m',
  body: 'moon',
  provider: 'USGS Astrogeology / NASA LRO',
  datasetName: 'Moon LRO LOLA Global LDEM 118m',
  datasetKind: 'dem',
  horizontalReference: 'MOON_MEAN_EARTH_POLAR_AXIS',
  verticalReference: 'MEAN_RADIUS_1737400_M',
  latitudeType: 'planetocentric',
  longitudeDirection: 'positive_east',
  sourceUri: 'remote://global-lola',
  accessMode: 'geotiff',
  status: 'ready',
  metadata: { stored_scale: 0.5, stored_offset: 0 },
}

const sample = await adapter.sampleAtPlanetary(dataset, frame, { latDeg: -89.67, lonDeg: 129.78 })
assert(sample !== null, 'ready cached coverage must resolve')
assert(sample!.sourceElevationM === 1000, 'cached sample must preserve LOLA DN scaling')
assert(sample!.tileKey === 'shackleton-001', 'sample must expose canonical cached tile key')
assert(openedUri === 'terrain://terrain/moon/lola/shackleton-001.tif', 'decoder must read external cached tile, not global source')

const missing = await adapter.sampleAtPlanetary(dataset, frame, { latDeg: -80, lonDeg: 129.78 })
assert(missing === null, 'missing cached coverage must remain unresolved')

console.log('Shackleton progressive terrain ingestion tests passed')
