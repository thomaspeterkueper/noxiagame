import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'
import { resolveAscentOrbitNode } from '@/lib/game/ascentTargets'

export type OrbitalPresence = {
  ship_id: string
  actor_profile_id: string
  orbit_node_slug: string
  body_slug: string
  source_ascent_mission_id: string
  entered_at: string
  updated_at: string
}

export type OrbitalPresenceSettlement = {
  shipId: string
  orbitNodeSlug: string
  bodySlug: string
  sourceAscentMissionId: string
  enteredAt: string
  idempotent: boolean
}

function coreError(command: string, error: { message?: string; code?: string; details?: string | null }) {
  const suffix = [error.code, error.message, error.details].filter(Boolean).join(' · ')
  return new Error(`${command} failed${suffix ? `: ${suffix}` : ''}`)
}

export async function getOrbitalPresenceForShip(
  actorProfileId: string,
  shipId: string,
): Promise<OrbitalPresence | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('orbital_presence')
    .select('*')
    .eq('ship_id', shipId)
    .eq('actor_profile_id', actorProfileId)
    .maybeSingle()
  if (error) throw coreError('orbital presence query', error)
  return data as OrbitalPresence | null
}

/**
 * Convert a completed ascent into authoritative orbital presence.
 * This is not docking and does not mutate the legacy ships.status enum.
 */
export async function settleAscentOrbitalPresence(input: {
  actorProfileId: string
  missionId: string
  targetOrbitNodeSlug: string
}): Promise<OrbitalPresenceSettlement> {
  const target = resolveAscentOrbitNode(input.targetOrbitNodeSlug)
  if (!target) throw new Error('NOXIA_ASCENT_TARGET_ORBIT_UNRESOLVED')

  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('noxia_settle_ascent_orbital_presence', {
    p_actor_profile_id: input.actorProfileId,
    p_mission_id: input.missionId,
    p_body_slug: target.bodySlug,
  })
  if (error) throw coreError('noxia_settle_ascent_orbital_presence', error)
  return data as OrbitalPresenceSettlement
}
