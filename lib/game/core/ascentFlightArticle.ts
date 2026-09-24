import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'
import type { EarthAscentPhysicalState } from '@/lib/game/core/earthAscentEngineeringAuthority'

export type PersistedSpacecraftFlightArticle = {
  ship_id: string
  owner_profile_id: string
  vehicle_instance_id: string
  engineering_frame_id: string
  engineering_authority_ref: string
  configuration_ref: string
  actual_start_mass_kg: number | null
  crew_mass_resolved: boolean
  cargo_mass_resolved: boolean
  mission_equipment_mass_resolved: boolean
  propellant_state_ref: string | null
  departure_site_ref: string | null
  departure_site_class: string | null
  release_speed_m_s: number | null
  target_plane_ref: string | null
  target_plane_resolved: boolean
  state_status: 'configured' | 'measured' | 'ready' | 'retired'
  provenance: Record<string, unknown>
  created_at: string
  updated_at: string
}

type CanonicalVehicleIdentity = {
  id: string
  frame_id: string
  owner_profile_id: string | null
  status: string
}

function coreError(command: string, error: { message?: string; code?: string; details?: string | null }) {
  const suffix = [error.code, error.message, error.details].filter(Boolean).join(' · ')
  return new Error(`${command} failed${suffix ? `: ${suffix}` : ''}`)
}

/**
 * Trusted Core lookup for the physical/Engineering identity of one concrete ship.
 * The flight article and shared vehicle identity must agree on owner and exact
 * Engineering frame. There is deliberately no name/type/client fallback.
 */
export async function getSpacecraftFlightArticle(
  actorProfileId: string,
  shipId: string,
): Promise<PersistedSpacecraftFlightArticle | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('spacecraft_flight_articles')
    .select('*')
    .eq('ship_id', shipId)
    .maybeSingle()

  if (error) throw coreError('spacecraft flight article lookup', error)
  if (!data) return null

  const row = data as unknown as PersistedSpacecraftFlightArticle
  if (row.owner_profile_id !== actorProfileId) throw new Error('NOXIA_ASCENT_FORBIDDEN')
  if (row.state_status === 'retired') return null

  const { data: vehicleData, error: vehicleError } = await supabase
    .from('vehicle_instances')
    .select('id,frame_id,owner_profile_id,status')
    .eq('id', row.vehicle_instance_id)
    .maybeSingle()
  if (vehicleError) throw coreError('spacecraft vehicle identity lookup', vehicleError)
  if (!vehicleData) throw new Error('NOXIA_FLIGHT_ARTICLE_VEHICLE_MISSING')

  const vehicle = vehicleData as unknown as CanonicalVehicleIdentity
  if (
    vehicle.owner_profile_id !== actorProfileId
    || vehicle.frame_id !== row.engineering_frame_id
    || vehicle.status === 'lost'
  ) {
    throw new Error('NOXIA_FLIGHT_ARTICLE_VEHICLE_MISMATCH')
  }

  return row
}

export function flightArticlePhysicalState(
  article: PersistedSpacecraftFlightArticle | null,
): EarthAscentPhysicalState | null {
  if (!article) return null
  return {
    actualStartMassKg: article.actual_start_mass_kg == null ? null : Number(article.actual_start_mass_kg),
    crewMassResolved: article.crew_mass_resolved,
    cargoMassResolved: article.cargo_mass_resolved,
    missionEquipmentMassResolved: article.mission_equipment_mass_resolved,
    propellantStateRef: article.propellant_state_ref,
    departureSiteClass: article.departure_site_class,
    releaseSpeedMS: article.release_speed_m_s == null ? null : Number(article.release_speed_m_s),
    targetPlaneResolved: article.target_plane_resolved,
  }
}
