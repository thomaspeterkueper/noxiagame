import type { TerrainDatasetDescriptor, WorldFrame } from './types'
import type { TerrainSampler } from './terrainSampling'
import {
  EffectiveSurfaceSampler,
  effectiveElevationDelta,
  mutationWeight,
  type PlanetarySurfaceMutation,
} from './surfaceMutation'

async function main() {
  function assert(condition: boolean, message: string) {
    if (!condition) throw new Error(message)
  }

  const frame: WorldFrame = {
    locationId: 'impact-test',
    body: 'moon',
    coordinateSystem: 'LOCAL_ENU_METERS',
    originLatDeg: -89,
    originLonDeg: 0,
    originAltM: 0,
    originStatus: 'verified',
    terrainDatasetId: 'fixture-lola',
    worldSeed: 'IMPACT-TEST',
  }

  const dataset: TerrainDatasetDescriptor = {
    id: 'fixture-lola',
    body: 'moon',
    provider: 'test',
    datasetName: 'immutable observed fixture',
    datasetKind: 'dem',
    horizontalReference: 'TEST',
    verticalReference: 'TEST_DATUM',
    latitudeType: 'planetocentric',
    longitudeDirection: 'positive_east',
    sourceUri: 'fixture://lola',
    accessMode: 'fixture',
    status: 'ready',
  }

  const baseSampler: TerrainSampler = {
    async sampleTerrainHeight(context, point) {
      const zM = 100 + point.xM * 0.01 - point.yM * 0.005
      return {
        ...point,
        zM,
        datasetId: context.dataset.id,
        sourceElevationM: zM,
        verticalReference: context.dataset.verticalReference,
      }
    },
  }

  const context = { frame, dataset }
  const point = { xM: 20, yM: -10 }
  const base = await baseSampler.sampleTerrainHeight(context, point)
  const passthrough = await new EffectiveSurfaceSampler(baseSampler).sampleTerrainHeight(context, point)

  assert(base !== null && passthrough !== null, 'fixture terrain must resolve')
  assert(passthrough!.zM === base!.zM, 'zero-mutation effective surface must preserve base z exactly')
  assert(passthrough!.sourceElevationM === base!.sourceElevationM, 'source elevation must remain immutable')
  assert(passthrough!.mutationDeltaM === 0, 'zero-mutation sample must report zero delta')
  assert(passthrough!.appliedMutationIds.length === 0, 'zero-mutation sample must report no mutation ids')

  const crater: PlanetarySurfaceMutation = {
    id: 'impact-fixture-crater',
    body: 'moon',
    locationId: 'impact-test',
    kind: 'impact_crater',
    provenance: 'simulated',
    centerXM: 0,
    centerYM: 0,
    radiusM: 100,
    elevationDeltaM: -20,
    falloff: 'linear',
    sourceEventId: 'impact-fixture',
  }

  assert(mutationWeight(crater, { xM: 0, yM: 0 }) === 1, 'mutation center must have full weight')
  assert(mutationWeight(crater, { xM: 100, yM: 0 }) === 0, 'mutation boundary must have zero weight')

  const center = await new EffectiveSurfaceSampler(baseSampler, [crater]).sampleTerrainHeight(
    context,
    { xM: 0, yM: 0 },
  )
  assert(center !== null, 'mutated center must resolve')
  assert(center!.observedZM === 100, 'observed/base elevation must be retained separately')
  assert(center!.zM === 80, 'effective elevation must include crater delta')
  assert(center!.sourceElevationM === 100, 'mutation must not rewrite source elevation')
  assert(center!.appliedMutationIds[0] === crater.id, 'effective sample must expose applied mutation provenance')

  const wrongBody = { ...crater, id: 'mars-only', body: 'mars' as const }
  const wrongLocation = { ...crater, id: 'other-site', locationId: 'elsewhere' }
  const filtered = effectiveElevationDelta([wrongBody, wrongLocation], context, { xM: 0, yM: 0 })
  assert(filtered.deltaM === 0, 'mutations from another body or scoped location must not leak across frames')

  const ejecta: PlanetarySurfaceMutation = {
    ...crater,
    id: 'impact-fixture-ejecta',
    kind: 'ejecta',
    elevationDeltaM: 4,
    radiusM: 200,
  }
  const composed = await new EffectiveSurfaceSampler(baseSampler, [crater, ejecta]).sampleTerrainHeight(
    context,
    { xM: 0, yM: 0 },
  )
  assert(composed !== null && composed.zM === 84, 'overlapping mutation fields must compose additively')
  assert(composed!.appliedMutationIds.length === 2, 'all applied mutation provenance must be retained')

  console.log('planetary surface mutation contract tests passed')
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
