import { LolaSouthPolarTerrainAdapter, SHACKLETON_POLAR_LOLA_DATASET_ID, lunarSouthPolarStereographic } from './lolaPolarTerrainAdapter'
import type { TerrainDatasetDescriptor, WorldFrame } from './types'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

async function main() {
  const origin = { latDeg: -89.67, lonDeg: 129.78 }
  const projected = lunarSouthPolarStereographic(origin)
  assert(Number.isFinite(projected.xM) && Number.isFinite(projected.yM), 'polar projection must produce metric coordinates')
  assert(Math.hypot(projected.xM, projected.yM) < 20_000, 'Shackleton should project close to the south-pole origin')

  let opened = ''
  let readWindow: [number, number, number, number] | null = null
  const adapter = new LolaSouthPolarTerrainAdapter(async uri => {
    opened = uri
    return {
      getWidth: () => 400,
      getHeight: () => 400,
      getBoundingBox: () => [projected.xM - 1000, projected.yM - 1000, projected.xM + 1000, projected.yM + 1000],
      getGDALNoData: () => -9999,
      async readRasters(options) {
        readWindow = options.window
        return new Float32Array([-1820])
      },
    }
  })

  const frame: WorldFrame = {
    locationId: 'moon-shackleton',
    body: 'moon',
    coordinateSystem: 'LOCAL_ENU_METERS',
    originLatDeg: origin.latDeg,
    originLonDeg: origin.lonDeg,
    originAltM: 0,
    originStatus: 'verified',
    referenceFrame: 'IAU_MOON_MEAN_SPHERE',
    latitudeType: 'planetocentric',
    longitudeDirection: 'positive_east',
    equatorialRadiusM: 1737400,
    polarRadiusM: 1737400,
    verticalDatum: 'MEAN_RADIUS_1737400_M',
    terrainDatasetId: SHACKLETON_POLAR_LOLA_DATASET_ID,
    worldSeed: 'MOON:SHACKLETON',
  }
  const dataset: TerrainDatasetDescriptor = {
    id: SHACKLETON_POLAR_LOLA_DATASET_ID,
    body: 'moon',
    provider: 'NASA GSFC PGDA / LRO LOLA',
    datasetName: 'LOLA Shackleton Rim Site04 5m',
    datasetKind: 'dem',
    resolutionM: 5,
    horizontalReference: 'MOON_ME_SOUTH_POLAR_STEREOGRAPHIC_DE421',
    verticalReference: 'MOON_ME_DE421_SURFACE_HEIGHT',
    latitudeType: 'planetocentric',
    longitudeDirection: 'positive_east',
    sourceUri: 'terrain://terrain/site04.tif',
    accessMode: 'polar-stereographic-geotiff',
    status: 'ready',
    metadata: { projection_radius_m: 1737400, projection_center_lon_deg: 0, stored_scale: 1, stored_offset: 0 },
  }

  const sample = await adapter.sampleAtPlanetary(dataset, frame, origin)
  assert(sample !== null, 'point inside projected Site04 bounds must resolve')
  assert(sample!.sourceElevationM === -1820, 'polar LDEM stores elevation directly in meters')
  assert(opened === dataset.sourceUri, 'adapter must open the provided cached terrain URI')
  assert(readWindow !== null, 'adapter must sample a concrete raster pixel')

  console.log('LOLA south-polar terrain adapter tests passed')
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
