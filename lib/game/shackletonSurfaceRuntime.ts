import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { LolaRasterImageOpener } from './spatial/lolaTerrainAdapter'
import type { TerrainSampleContext, TerrainSampleRequest } from './spatial/terrainSampling'
import { loadShackletonTerrainRuntime } from './spatial/shackletonTerrainRuntime'
import {
  resolveShackletonSurfaceMissionPlan,
  type ShackletonSurfaceRouteRequest,
  type ShackletonSurfaceRouteResolution,
} from './moonSurfaceRouting'

export type ShackletonRuntimeRouteResolution =
  | { ok: true; route: ShackletonSurfaceRouteResolution }
  | {
      ok: false
      code:
        | 'ROUTE_GEOMETRY_REQUIRED'
        | 'LOLA_TILE_RUNTIME_UNAVAILABLE'
        | 'LOLA_DECODER_UNAVAILABLE'
        | 'LOLA_ROUTE_UNRESOLVED'
      error: string
      details?: unknown
    }

export interface ResolveShackletonRuntimeRouteInput {
  supabase: SupabaseClient
  terrainContext: TerrainSampleContext
  request: Omit<ShackletonSurfaceRouteRequest, 'points'> & {
    /** Candidate geometry must come from the Moon routing domain; never synthesized here. */
    points: readonly TerrainSampleRequest[]
  }
  openImage?: LolaRasterImageOpener | null
}

/**
 * Server-side bridge from persisted LOLA tiles to the canonical Moon mission plan.
 *
 * This function deliberately does not create a route from origin/destination.
 * Candidate geometry has to be supplied by a Moon routing source. It also does
 * not provide vehicle physics: the caller must supply the Engineering-backed
 * mobility envelope already required by ShackletonSurfaceRouteRequest.
 */
export async function resolveShackletonRuntimeRoute(
  input: ResolveShackletonRuntimeRouteInput,
): Promise<ShackletonRuntimeRouteResolution> {
  if (input.request.points.length < 2) {
    return {
      ok: false,
      code: 'ROUTE_GEOMETRY_REQUIRED',
      error: 'Moon routing must provide at least two authoritative candidate route points.',
    }
  }

  const runtime = await loadShackletonTerrainRuntime(input.supabase, input.openImage)
  if (runtime.status.runtimeReadyTiles === 0) {
    return {
      ok: false,
      code: 'LOLA_TILE_RUNTIME_UNAVAILABLE',
      error: 'No validated persisted LOLA tile is available to the Shackleton runtime.',
      details: runtime.status,
    }
  }
  if (!runtime.sampler) {
    return {
      ok: false,
      code: 'LOLA_DECODER_UNAVAILABLE',
      error: 'Validated LOLA tiles exist, but no server GeoTIFF decoder is connected.',
      details: runtime.status,
    }
  }

  try {
    const route = await resolveShackletonSurfaceMissionPlan(
      runtime.sampler,
      input.terrainContext,
      input.request,
    )
    return { ok: true, route }
  } catch (error) {
    return {
      ok: false,
      code: 'LOLA_ROUTE_UNRESOLVED',
      error: error instanceof Error ? error.message : String(error),
      details: runtime.status,
    }
  }
}
