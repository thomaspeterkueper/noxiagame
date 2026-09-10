import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'
import { DOCKING_IDLE_EXPIRE_HOURS } from '@/lib/game/config'
import { baseTravelSeconds, flightEnergyCost } from '@/lib/game/ships'
import { distance, ORBITS } from '@/lib/game/orbits'
import {
  completeTransitCommand,
  startTransitCommand,
  type AtomicTransitCompletionResult,
  type AtomicTransitStartResult,
} from '@/lib/game/core/commands'

type ActiveShip = {
  id: string
  profile_id: string
  location: string
  status: 'docked' | 'transit'
  dest_location: string | null
  arrives_at: string | null
  transit_started_at: string | null
  ship_type_id: string | null
  cargo_max: number
  is_active: boolean | null
}

export type PlayerTransitState = {
  shipId: string
  status: 'docked' | 'transit'
  location: string
  from: string | null
  to: string | null
  departedAt: string | null
  arrivesAt: string | null
  totalSeconds: number
  remainingSeconds: number
}

async function activeShipForProfile(profileId: string): Promise<ActiveShip | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('ships')
    .select('id, profile_id, location, status, dest_location, arrives_at, transit_started_at, ship_type_id, cargo_max, is_active, created_at')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`active ship lookup failed: ${error.message}`)
  const rows = (data ?? []) as unknown as ActiveShip[]
  return rows.find(ship => ship.is_active) ?? rows[0] ?? null
}

export async function startPlayerTransit(profileId: string, destination: string): Promise<AtomicTransitStartResult> {
  const supabase = createServiceClient()
  const ship = await activeShipForProfile(profileId)
  if (!ship) throw new Error('NOXIA_SHIP_NOT_FOUND')

  if (ship.status === 'transit' && ship.dest_location !== destination) {
    throw new Error(`NOXIA_TRANSIT_ALREADY_ACTIVE:${ship.dest_location ?? '<unknown>'}`)
  }

  if (!ORBITS[ship.location] || !ORBITS[destination]) {
    throw new Error(`NOXIA_TRANSIT_ROUTE_UNKNOWN:${ship.location}:${destination}`)
  }

  const { data: tickRow } = await supabase
    .from('tick_log')
    .select('tick_number')
    .order('tick_number', { ascending: false })
    .limit(1)
    .maybeSingle()
  const tick = Number(tickRow?.tick_number ?? 0)

  const { data: shipType } = ship.ship_type_id
    ? await supabase
        .from('ship_types')
        .select('speed_mult, range_distance')
        .eq('id', ship.ship_type_id)
        .maybeSingle()
    : { data: null }

  const speedMult = Number((shipType as any)?.speed_mult ?? 1)
  if (!Number.isFinite(speedMult) || speedMult <= 0) {
    throw new Error(`NOXIA_TRANSIT_SPEED_INVALID:${speedMult}`)
  }

  const routeDistance = distance(ship.location, destination, tick)
  const rangeDistance = Number((shipType as any)?.range_distance ?? Number.POSITIVE_INFINITY)
  if (Number.isFinite(rangeDistance) && routeDistance > rangeDistance) {
    throw new Error(`NOXIA_TRANSIT_OUT_OF_RANGE:${routeDistance}:${rangeDistance}`)
  }

  const baseDuration = baseTravelSeconds(ship.location as any, destination as any, tick)
  if (baseDuration == null) {
    throw new Error(`NOXIA_TRANSIT_ROUTE_UNKNOWN:${ship.location}:${destination}`)
  }

  // speed_mult is a speed factor, not a duration multiplier. A 1.7 ship must
  // arrive sooner; this also matches lib/game/ships.travelTime().
  const durationSeconds = Math.max(1, Math.round(baseDuration / speedMult))
  const energyNeeded = flightEnergyCost(ship.location, destination)

  return startTransitCommand({
    profileId,
    destination,
    durationSeconds,
    energyNeeded,
    dockingIdleHours: DOCKING_IDLE_EXPIRE_HOURS,
  })
}

export async function completePlayerTransit(profileId: string): Promise<AtomicTransitCompletionResult | null> {
  const ship = await activeShipForProfile(profileId)
  if (!ship) throw new Error('NOXIA_SHIP_NOT_FOUND')
  if (ship.status !== 'transit') return null
  return completeTransitCommand(ship.id)
}

export async function settleDuePlayerTransit(profileId: string): Promise<AtomicTransitCompletionResult | null> {
  const ship = await activeShipForProfile(profileId)
  if (!ship || ship.status !== 'transit' || !ship.arrives_at) return null
  if (new Date(ship.arrives_at).getTime() > Date.now()) return null
  return completeTransitCommand(ship.id)
}

export async function getPlayerTransitState(profileId: string): Promise<PlayerTransitState | null> {
  await settleDuePlayerTransit(profileId)
  const ship = await activeShipForProfile(profileId)
  if (!ship) return null

  if (ship.status !== 'transit' || !ship.dest_location || !ship.arrives_at) {
    return {
      shipId: ship.id,
      status: 'docked',
      location: ship.location,
      from: null,
      to: null,
      departedAt: null,
      arrivesAt: null,
      totalSeconds: 0,
      remainingSeconds: 0,
    }
  }

  const arrivesMs = new Date(ship.arrives_at).getTime()
  const departedMs = ship.transit_started_at ? new Date(ship.transit_started_at).getTime() : Date.now()
  const totalSeconds = Math.max(1, Math.round((arrivesMs - departedMs) / 1000))
  const remainingSeconds = Math.max(0, Math.ceil((arrivesMs - Date.now()) / 1000))

  return {
    shipId: ship.id,
    status: 'transit',
    location: ship.location,
    from: ship.location,
    to: ship.dest_location,
    departedAt: ship.transit_started_at,
    arrivesAt: ship.arrives_at,
    totalSeconds,
    remainingSeconds,
  }
}
