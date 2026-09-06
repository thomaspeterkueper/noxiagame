import { sampleTerrainSurface, withTerrainHillshade } from './terrainSurface'
import type { TerrainSampler } from './terrainSampling'
import type { TerrainDatasetDescriptor, WorldFrame } from './types'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const frame: WorldFrame = {
  locationId: 'surface-fixture',
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
  terrainDatasetId: 'surface-fixture',
  worldSeed: 'SURFACE',
}

const dataset: TerrainDatasetDescriptor = {
  id: 'surface-fixture',
  body: 'moon',
  provider: 'fixture',
  datasetName: 'surface fixture',
  datasetKind: 'dem',
  horizontalReference: 'MOON_MEAN_EARTH_POLAR_AXIS',
  verticalReference: 'MEAN_RADIUS_1737400_M',
  latitudeType: 'planetocentric',
  longitudeDirection: 'positive_east',
  sourceUri: 'fixture://surface',
  accessMode: 'fixture',
  status: 'ready',
}

const sampler: TerrainSampler = {
  async sampleTerrainHeight(_context, point) {
    if (point.xM === 20 && point.yM === 20) return null
    return {
      xM: point.xM,
      yM: point.yM,
      zM: point.xM * 0.1 + point.yM * 0.2,
      sourceElevationM: 1000,
      datasetId: dataset.id,
      verticalReference: dataset.verticalReference,
    }
  },
}

const surface = await sampleTerrainSurface(sampler, { frame, dataset }, {
  minXM: 0,
  minYM: 0,
  maxXM: 20,
  maxYM: 20,
  columns: 3,
  rows: 3,
})
assert(surface.cells.length === 9, 'surface must contain rows x columns samples')
assert(surface.stepXM === 10 && surface.stepYM === 10, 'surface spacing must stay metric')
assert(surface.resolvedCount === 8, 'NoData must remain unresolved instead of receiving fallback z')
assert(surface.cells[4].zM === 3, 'center elevation must preserve canonical sampler z')
assert(surface.cells[8].zM === null, 'missing source sample must remain null')

const shaded = withTerrainHillshade(surface)
assert(shaded.cells[4].hillshade !== null, 'complete central neighbourhood must produce hillshade')
assert(shaded.cells[4].zM === surface.cells[4].zM, 'hillshade must not mutate canonical elevation')
assert(shaded.cells[0].hillshade === null, 'edge without complete neighbours must remain unshaded')
assert(shaded.cells[8].hillshade === null, 'NoData cell must remain unshaded')

console.log('terrain surface projection tests passed')
