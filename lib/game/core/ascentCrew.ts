import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'

export type PlayerCrewRole = 'commander' | 'pilot' | 'crew'

export type PlayerCrewState = {
  shipId: string
  profileId: string
  role: PlayerCrewRole
  active: boolean
  boardedAt?: string
  leftAt?: string
  idempotent?: boolean
}

function commandError(command: string, error: { message?: string; code?: string; details?: string | null }) {
  const suffix = [error.code, error.message, error.details].filter(Boolean).join(' · ')
  return new Error(`${command} failed${suffix ? `: ${suffix}` : ''}`)
}

export async function getPlayerCrewState(profileId: string, shipId: string) {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('ship_crew_manifest')
    .select('ship_id,profile_id,role,active,boarded_at,left_at')
    .eq('ship_id', shipId)
    .eq('profile_id', profileId)
    .eq('active', true)
    .maybeSingle()

  if (error) throw commandError('ship crew manifest query', error)
  if (!data) return null

  return {
    shipId: data.ship_id,
    profileId: data.profile_id,
    role: data.role as PlayerCrewRole,
    active: data.active,
    boardedAt: data.boarded_at,
    leftAt: data.left_at ?? undefined,
  } satisfies PlayerCrewState
}

export async function boardPlayerCrew(profileId: string, shipId: string, role: PlayerCrewRole = 'commander') {
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('noxia_board_player_crew', {
    p_profile_id: profileId,
    p_ship_id: shipId,
    p_role: role,
  })
  if (error) throw commandError('noxia_board_player_crew', error)
  return data as PlayerCrewState
}

export async function leavePlayerCrew(profileId: string, shipId: string) {
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('noxia_leave_player_crew', {
    p_profile_id: profileId,
    p_ship_id: shipId,
  })
  if (error) throw commandError('noxia_leave_player_crew', error)
  return data as PlayerCrewState
}
