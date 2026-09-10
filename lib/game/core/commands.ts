import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'

export type StartBuildCommand = {
  profileId: string
  buildableId: string
  locationId: string
  costCredits: number
  completesAt: string
  tileLevel?: number
  tileRow?: number | null
  tileCol?: number | null
  placementMode?: 'legacy_tile' | 'world' | null
  xM?: number | null
  yM?: number | null
  zM?: number | null
  rotationDeg?: number
  footprintWidthM?: number | null
  footprintDepthM?: number | null
  siteId?: string | null
  terrainDatasetId?: string | null
  terrainStatus?: 'origin_pending' | 'dataset_pending' | 'unresolved' | 'resolved'
  groundElevationM?: number | null
  terrainMinElevationM?: number | null
  terrainMaxElevationM?: number | null
  terrainSlopeDeg?: number | null
  latitudeDeg?: number | null
  longitudeDeg?: number | null
  altitudeM?: number | null
  spatialRegionId?: string | null
}

export type AtomicBuildResult = {
  build_id: string
  status: string
  completes_at?: string
  credits?: number
  entity_id?: string | null
  payout?: number
  idempotent?: boolean
}

export type AtomicTradeResult = {
  order_id: string
  ship_id: string
  reward: number
  base_reward: number
  server_max_reward: number
  credits: number
  resource: string
  cargo_amount: number
  location_stock: number
}

function commandError(command: string, error: { message?: string; code?: string; details?: string | null }) {
  const suffix = [error.code, error.message, error.details].filter(Boolean).join(' · ')
  return new Error(`${command} failed${suffix ? `: ${suffix}` : ''}`)
}

export async function startBuildCommand(input: StartBuildCommand): Promise<AtomicBuildResult> {
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('noxia_start_build', {
    p_profile_id: input.profileId,
    p_buildable_id: input.buildableId,
    p_location_id: input.locationId,
    p_cost_credits: input.costCredits,
    p_completes_at: input.completesAt,
    p_tile_level: input.tileLevel ?? 0,
    p_tile_row: input.tileRow ?? null,
    p_tile_col: input.tileCol ?? null,
    p_placement_mode: input.placementMode ?? null,
    p_x_m: input.xM ?? null,
    p_y_m: input.yM ?? null,
    p_z_m: input.zM ?? null,
    p_rotation_deg: input.rotationDeg ?? 0,
    p_footprint_width_m: input.footprintWidthM ?? null,
    p_footprint_depth_m: input.footprintDepthM ?? null,
    p_site_id: input.siteId ?? null,
    p_terrain_dataset_id: input.terrainDatasetId ?? null,
    p_terrain_status: input.terrainStatus ?? 'origin_pending',
    p_ground_elevation_m: input.groundElevationM ?? null,
    p_terrain_min_elevation_m: input.terrainMinElevationM ?? null,
    p_terrain_max_elevation_m: input.terrainMaxElevationM ?? null,
    p_terrain_slope_deg: input.terrainSlopeDeg ?? null,
    p_latitude_deg: input.latitudeDeg ?? null,
    p_longitude_deg: input.longitudeDeg ?? null,
    p_altitude_m: input.altitudeM ?? null,
    p_spatial_region_id: input.spatialRegionId ?? null,
  })

  if (error) throw commandError('noxia_start_build', error)
  return data as AtomicBuildResult
}

export async function completeBuildCommand(buildId: string, createEntity = true): Promise<AtomicBuildResult> {
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('noxia_complete_build', {
    p_build_id: buildId,
    p_create_entity: createEntity,
  })

  if (error) throw commandError('noxia_complete_build', error)
  return data as AtomicBuildResult
}

export async function completeSaleCommand(buildId: string): Promise<AtomicBuildResult> {
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('noxia_complete_sale', { p_build_id: buildId })

  if (error) throw commandError('noxia_complete_sale', error)
  return data as AtomicBuildResult
}

export async function fulfillTradeOrderCommand(
  profileId: string,
  orderId: string,
  agreedReward: number | null,
): Promise<AtomicTradeResult> {
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('noxia_fulfill_trade_order', {
    p_profile_id: profileId,
    p_order_id: orderId,
    p_agreed_reward: agreedReward,
  })

  if (error) throw commandError('noxia_fulfill_trade_order', error)
  return data as AtomicTradeResult
}
