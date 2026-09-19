import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'
import type { AscentControlPhase } from '@/lib/game/ascentControl'

export type PersistedAscentMissionStatus = 'active' | 'completed' | 'cancelled'

export type PersistedAscentMission = {
  id: string
  ship_id: string
  actor_profile_id: string
  departure_surface_slug: string
  target_orbit_node_slug: string
  engineering_authority_ref: string
  phase: AscentControlPhase
  status: PersistedAscentMissionStatus
  authorized_at: string
  started_at: string | null
  insertion_at: string | null
  arrived_at: string | null
  settled_at: string | null
  created_at: string
  updated_at: string
}

export type AscentCommandResult = {
  missionId: string
  shipId: string
  phase: AscentControlPhase
  status: PersistedAscentMissionStatus
  targetOrbitNodeSlug?: string
  departureSurfaceSlug?: string
  engineeringAuthorityRef?: string
  arrivalControlPhase?: 'arrival-rendezvous' | null
  idempotent: boolean
}

export type AscentTransitionAction = 'cancel' | 'start' | 'mark_insertion' | 'mark_arrival'

function coreError(command: string, error: { message?: string; code?: string; details?: string | null }) {
  const suffix = [error.code, error.message, error.details].filter(Boolean).join(' · ')
  return new Error(`${command} failed${suffix ? `: ${suffix}` : ''}`)
}

export async function getAscentMissionForShip(
  actorProfileId: string,
  shipId: string,
): Promise<PersistedAscentMission | null> {
  const supabase = createServiceClient()

  const { data: ship, error: shipError } = await supabase
    .from('ships')
    .select('id,profile_id')
    .eq('id', shipId)
    .maybeSingle()
  if (shipError) throw coreError('ship lookup', shipError)
  if (!ship) return null
  if (ship.profile_id !== actorProfileId) throw new Error('NOXIA_ASCENT_FORBIDDEN')

  const { data, error } = await supabase
    .from('ascent_missions')
    .select('*')
    .eq('ship_id', shipId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw coreError('ascent mission query', error)
  return data as unknown as PersistedAscentMission | null
}

/**
 * Trusted Core command. Callers must resolve a real Engineering authority before use.
 * Public gameplay routes deliberately do not expose this command while the lunar
 * Engineering profile request remains unresolved.
 */
export async function authorizeAscentCommand(input: {
  commandId: string
  actorProfileId: string
  shipId: string
  departureSurfaceSlug: string
  targetOrbitNodeSlug: string
  engineeringAuthorityRef: string
}): Promise<AscentCommandResult> {
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('noxia_authorize_ascent', {
    p_command_id: input.commandId,
    p_actor_profile_id: input.actorProfileId,
    p_ship_id: input.shipId,
    p_departure_surface_slug: input.departureSurfaceSlug,
    p_target_orbit_node_slug: input.targetOrbitNodeSlug,
    p_engineering_authority_ref: input.engineeringAuthorityRef,
  })
  if (error) throw coreError('noxia_authorize_ascent', error)
  return data as unknown as AscentCommandResult
}

/**
 * Trusted execution hook for a future scheduler/flight resolver. It stores no timing,
 * delta-v, fuel, mass, or trajectory defaults of its own.
 */
export async function transitionAscentCommand(input: {
  commandId: string
  actorProfileId: string
  missionId: string
  action: AscentTransitionAction
}): Promise<AscentCommandResult> {
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('noxia_transition_ascent', {
    p_command_id: input.commandId,
    p_actor_profile_id: input.actorProfileId,
    p_mission_id: input.missionId,
    p_action: input.action,
  })
  if (error) throw coreError('noxia_transition_ascent', error)
  return data as unknown as AscentCommandResult
}
