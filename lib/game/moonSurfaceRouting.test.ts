import { resolveShackletonSurfaceMissionPlan } from './moonSurfaceRouting'
import type { ResolvedTerrainHeightSample, TerrainSampleContext, TerrainSampleRequest, TerrainSampler } from './spatial/terrainSampling'

function assert(condition: boolean, message: string) { if (!condition) throw new Error(message) }

const context: TerrainSampleContext = {
  frame: { locationId: 'moon-shackleton-test', body: 'moon', coordinateSystem: 'local-enu', originStatus: 'verified', originLatDeg: -89.9, originLonDeg: 0, originAltM: 0, terrainDatasetId: 'moon_lro_lola_118m', worldSeed: 'shackleton-test' },
  dataset: { id: 'moon_lro_lola_118m', body: 'moon', locationId: 'moon-shackleton-test', provider: 'NASA/LRO', datasetName: 'LOLA test fixture', datasetKind: 'dem', sourceUri: 'terrain://fixture/shackleton', horizontalReference: 'IAU_MOON', verticalReference: 'MEAN_RADIUS', latitudeType: 'planetocentric', longitudeDirection: 'positive_east', accessMode: 'fixture', resolutionM: 118, status: 'ready' },
}

class FixtureSampler implements TerrainSampler {
  constructor(private readonly elevations: Map<string, number | null>) {}
  async sampleTerrainHeight(sampleContext: TerrainSampleContext, point: TerrainSampleRequest): Promise<ResolvedTerrainHeightSample | null> {
    const elevation = this.elevations.get(`${point.xM},${point.yM}`)
    if (elevation == null) return null
    return { xM: point.xM, yM: point.yM, zM: elevation, datasetId: sampleContext.dataset.id, sourceElevationM: elevation, verticalReference: sampleContext.dataset.verticalReference }
  }
}

const points = [{ xM: 0, yM: 0 }, { xM: 100, yM: 0 }, { xM: 200, yM: 0 }]

async function run() {
  const resolved = await resolveShackletonSurfaceMissionPlan(new FixtureSampler(new Map([['0,0', 0], ['100,0', 4], ['200,0', 0]])), context, { routeId: 'shackleton-mine-to-hub', originInventoryId: 'tile-entity:mine-buffer', destinationInventoryId: 'tile-entity:logistics-hub', routeClass: 'prepared-track', vehicle: { role: 'cargo-rover', safeLongitudinalSlopeDeg: 12 }, points })
  assert(Math.abs(resolved.metrics.distanceM - 200) < 1e-9, 'route distance must derive from local-world polyline')
  assert(resolved.assessment.passable, 'gentle LOLA-derived fixture route must be passable')
  assert(resolved.plan.segments[0].traversal.passable, 'Moon assessment must flow into shared traversal contract')

  const steep = await resolveShackletonSurfaceMissionPlan(new FixtureSampler(new Map([['0,0', 0], ['100,0', 30], ['200,0', 0]])), context, { routeId: 'shackleton-steep-candidate', originInventoryId: 'tile-entity:mine-buffer', destinationInventoryId: 'tile-entity:logistics-hub', routeClass: 'offroad', vehicle: { role: 'cargo-rover', safeLongitudinalSlopeDeg: 12 }, points })
  assert(!steep.assessment.passable, 'steep terrain must block the route')

  let unresolvedRejected = false
  try {
    await resolveShackletonSurfaceMissionPlan(new FixtureSampler(new Map([['0,0', 0], ['100,0', null], ['200,0', 0]])), context, { routeId: 'shackleton-nodata-candidate', originInventoryId: 'tile-entity:mine-buffer', destinationInventoryId: 'tile-entity:logistics-hub', routeClass: 'prepared-track', vehicle: { role: 'cargo-rover', safeLongitudinalSlopeDeg: 12 }, points })
  } catch (error) {
    unresolvedRejected = error instanceof Error && error.message.includes('terrain unresolved')
  }
  assert(unresolvedRejected, 'NoData coverage must reject route resolution')
  console.log('moon surface routing tests passed')
}

void run().catch(error => { console.error(error); process.exitCode = 1 })
