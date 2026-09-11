import { resolveShackletonSurfaceMissionPlan } from './moonSurfaceRouting'
import type {
  ResolvedTerrainHeightSample,
  TerrainSampleContext,
  TerrainSampleRequest,
  TerrainSampler,
} from './spatial/terrainSampling'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const context: TerrainSampleContext = {
  frame: {
    id: 'moon-shackleton-test',
    bodyId: 'moon',
    kind: 'local-enu',
    originStatus: 'verified',
    originLatDeg: -89.9,
    originLonDeg: 0,
    originAltM: 0,
    terrainDatasetId: 'moon_lro_lola_118m',
  },
  dataset: {
    id: 'moon_lro_lola_118m',
    bodyId: 'moon',
    label: 'LOLA test fixture',
    sourceUri: 'terrain://fixture/shackleton',
    horizontalReference: 'IAU_MOON',
    verticalReference: 'MEAN_RADIUS',
    resolutionM: 118,
    status: 'ready',
  },
}

class FixtureSampler implements TerrainSampler {
  constructor(private readonly elevations: Map<string, number | null>) {}

  async sampleTerrainHeight(
    sampleContext: TerrainSampleContext,
    point: TerrainSampleRequest,
  ): Promise<ResolvedTerrainHeightSample | null> {
    const elevation = this.elevations.get(`${point.xM},${point.yM}`)
    if (elevation == null) return null
    return {
      xM: point.xM,
      yM: point.yM,
      zM: elevation,
      datasetId: sampleContext.dataset.id,
      sourceElevationM: elevation,
      verticalReference: sampleContext.dataset.verticalReference,
    }
  }
}

const points = [
  { xM: 0, yM: 0 },
  { xM: 100, yM: 0 },
  { xM: 200, yM: 0 },
]

const sampler = new FixtureSampler(new Map([
  ['0,0', 0],
  ['100,0', 4],
  ['200,0', 0],
]))

const resolved = await resolveShackletonSurfaceMissionPlan(sampler, context, {
  routeId: 'shackleton-mine-to-hub',
  originInventoryId: 'tile-entity:mine-buffer',
  destinationInventoryId: 'tile-entity:logistics-hub',
  routeClass: 'prepared-track',
  // Test fixture only: runtime capability must come from Engineering/Core mapping.
  vehicle: { role: 'cargo-rover', safeLongitudinalSlopeDeg: 12 },
  points,
})

assert(Math.abs(resolved.metrics.distanceM - 200) < 1e-9, 'route distance must derive from local-world polyline')
assert(resolved.assessment.passable, 'gentle LOLA-derived fixture route must be passable')
assert(resolved.plan.routeId === 'shackleton-mine-to-hub', 'shared mission plan must preserve route id')
assert(resolved.plan.segments.length === 1, 'Shackleton adapter must produce one assessed terrain segment')
assert(Math.abs(resolved.plan.segments[0].distanceKm - 0.2) < 1e-9, 'mission distance must be expressed in kilometres')
assert(resolved.plan.segments[0].traversal.passable, 'Moon assessment must flow into shared traversal contract')

const steepSampler = new FixtureSampler(new Map([
  ['0,0', 0],
  ['100,0', 30],
  ['200,0', 0],
]))
const steep = await resolveShackletonSurfaceMissionPlan(steepSampler, context, {
  routeId: 'shackleton-steep-candidate',
  originInventoryId: 'tile-entity:mine-buffer',
  destinationInventoryId: 'tile-entity:logistics-hub',
  routeClass: 'offroad',
  vehicle: { role: 'cargo-rover', safeLongitudinalSlopeDeg: 12 },
  points,
})
assert(!steep.assessment.passable, 'terrain slope exceeding supplied mobility envelope must block the route')
assert(!steep.plan.segments[0].traversal.passable, 'blocked Moon route must remain blocked in shared mission plan')

let unresolvedRejected = false
try {
  await resolveShackletonSurfaceMissionPlan(
    new FixtureSampler(new Map([
      ['0,0', 0],
      ['100,0', null],
      ['200,0', 0],
    ])),
    context,
    {
      routeId: 'shackleton-nodata-candidate',
      originInventoryId: 'tile-entity:mine-buffer',
      destinationInventoryId: 'tile-entity:logistics-hub',
      routeClass: 'prepared-track',
      vehicle: { role: 'cargo-rover', safeLongitudinalSlopeDeg: 12 },
      points,
    },
  )
} catch (error) {
  unresolvedRejected = error instanceof Error && error.message.includes('terrain unresolved')
}
assert(unresolvedRejected, 'NoData coverage must reject route resolution instead of synthesizing terrain')

console.log('moon surface routing tests passed')
