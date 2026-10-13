import type { SpatialProvenance, WorldBody } from './types'
import type {
  ResolvedTerrainHeightSample,
  TerrainSampleContext,
  TerrainSampleRequest,
  TerrainSampler,
} from './terrainSampling'

export type SurfaceMutationKind = 'impact_crater' | 'ejecta' | 'geological' | 'construction' | 'other'

export interface PlanetarySurfaceMutation {
  id: string
  body: WorldBody
  locationId?: string | null
  kind: SurfaceMutationKind
  provenance: Extract<SpatialProvenance, 'derived' | 'simulated' | 'synthetic'>
  centerXM: number
  centerYM: number
  radiusM: number
  elevationDeltaM: number
  falloff?: 'linear' | 'smoothstep'
  sourceEventId?: string | null
  metadata?: Record<string, unknown>
}

export interface EffectiveSurfaceSample extends ResolvedTerrainHeightSample {
  observedZM: number
  mutationDeltaM: number
  appliedMutationIds: string[]
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value))
}

export function mutationWeight(
  mutation: PlanetarySurfaceMutation,
  point: TerrainSampleRequest,
): number {
  if (!Number.isFinite(mutation.radiusM) || mutation.radiusM <= 0) return 0
  const dx = point.xM - mutation.centerXM
  const dy = point.yM - mutation.centerYM
  const normalizedDistance = Math.hypot(dx, dy) / mutation.radiusM
  if (normalizedDistance >= 1) return 0

  const linear = 1 - clamp01(normalizedDistance)
  if (mutation.falloff === 'smoothstep') {
    return linear * linear * (3 - 2 * linear)
  }
  return linear
}

export function mutationAppliesToContext(
  mutation: PlanetarySurfaceMutation,
  context: TerrainSampleContext,
): boolean {
  if (mutation.body !== context.frame.body) return false
  return mutation.locationId == null || mutation.locationId === context.frame.locationId
}

export function effectiveElevationDelta(
  mutations: readonly PlanetarySurfaceMutation[],
  context: TerrainSampleContext,
  point: TerrainSampleRequest,
): { deltaM: number; mutationIds: string[] } {
  let deltaM = 0
  const mutationIds: string[] = []

  for (const mutation of mutations) {
    if (!mutationAppliesToContext(mutation, context)) continue
    const weight = mutationWeight(mutation, point)
    if (weight <= 0) continue
    deltaM += mutation.elevationDeltaM * weight
    mutationIds.push(mutation.id)
  }

  return { deltaM, mutationIds }
}

/**
 * Composes immutable observed/synthetic terrain with later physical surface
 * mutations. The base sampler remains authoritative for its source elevation
 * and vertical reference; mutation effects exist only in the effective layer.
 */
export class EffectiveSurfaceSampler implements TerrainSampler {
  constructor(
    private readonly baseSampler: TerrainSampler,
    private readonly mutations: readonly PlanetarySurfaceMutation[] = [],
  ) {}

  async sampleTerrainHeight(
    context: TerrainSampleContext,
    point: TerrainSampleRequest,
  ): Promise<EffectiveSurfaceSample | null> {
    const base = await this.baseSampler.sampleTerrainHeight(context, point)
    if (!base) return null

    const { deltaM, mutationIds } = effectiveElevationDelta(this.mutations, context, point)
    return {
      ...base,
      observedZM: base.zM,
      zM: base.zM + deltaM,
      mutationDeltaM: deltaM,
      appliedMutationIds: mutationIds,
    }
  }
}
