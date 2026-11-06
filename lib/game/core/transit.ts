import 'server-only'
// lib/game/core/transit.ts
// Aktualisiert: 27.10.2026 — Oberflächenorte erreichbar: Orte werden vor der Routenprüfung nach Körper angemeldet (registerLocationBodies), Prüfung über hasOrbit
// Version:      1.1.0

import { createServiceClient } from '@/lib/supabase/service'
import { DOCKING_IDLE_EXPIRE_HOURS } from '@/lib/game/config'
import { hasOrbit } from '@/lib/game/orbits'
import { registerLocationBodies } from '@/lib/game/locationBody'
import { passengerTicketPrice, transferQuote } from '@/lib/game/transfer'
import { passengerOffers, type PassengerOffer } from '@/lib/game/passengerOffers'
import { getPlayerUnlocks } from '@/lib/knowledge/unlocks'
import { navigationProficiencyFromUnlocks } from '@/lib/knowledge/navigationProficiency'
import { hasPilotTraining, pilotFee } from '@/lib/game/pilotQualification'
import { availablePilots, hiredPilotFee, pilotByIndex, pilotDay, type HiredPilot } from '@/lib/game/pilots'
import {
  completePassengerTransitCommand,
  completeTransitCommand,
  startPassengerTransitCommand,
  startTransitCommand,
  type AtomicTransitCompletionResult,
  type AtomicTransitStartResult,
} from '@/lib/game/core/commands'

type PassengerProfile = {
  current_location: string
  transit_destination: string | null
  transit_departed_at: string | null
  transit_arrives_at: string | null
}

// Spieler ohne eigenes Schiff reisen ueber den Spediteur (Linienflug, s.
// Migration 20261003190000_passenger_transit_without_ship.sql) -- Zustand
// liegt auf profiles statt auf ships.
async function passengerProfile(profileId: string): Promise<PassengerProfile | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('current_location, transit_destination, transit_departed_at, transit_arrives_at')
    .eq('id', profileId)
    .maybeSingle()
  if (error) throw new Error(`passenger profile lookup failed: ${error.message}`)
  return data ?? null
}

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

export type StationArrivalPhase = 'arrival-rendezvous' | 'holding' | 'approach' | 'docked' | 'departing'

export type StationArrivalState = {
  shipId: string
  stationSlug: string
  phase: StationArrivalPhase
  holdingZoneId: string | null
  holdingReason: string | null
  queuePosition: number | null
  targetPortId: string | null
  updatedAt: string | null
}

export type PlayerTransitState = {
  shipId: string
  status: 'docked' | 'transit' | StationArrivalPhase
  location: string
  from: string | null
  to: string | null
  departedAt: string | null
  arrivesAt: string | null
  totalSeconds: number
  remainingSeconds: number
  arrival: StationArrivalState | null
}

/**
 * Das Schiff, auf dem der Spieler gerade ist (profiles.aboard_ship_id, Migration
 * 20261103190000). Ein geparktes Schiff zählt nicht: ohne Schiff an Bord gilt der Linienflug.
 */
async function activeShipForProfile(profileId: string): Promise<ActiveShip | null> {
  const supabase = createServiceClient()
  const { data: profile, error: profileError } = await supabase.from('profiles').select('aboard_ship_id').eq('id', profileId).maybeSingle()
  if (profileError) throw new Error(`aboard ship lookup failed: ${profileError.message}`)
  const shipId = (profile as { aboard_ship_id?: string | null } | null)?.aboard_ship_id
  if (!shipId) return null
  const { data, error } = await supabase
    .from('ships')
    .select('id, profile_id, location, status, dest_location, arrives_at, transit_started_at, ship_type_id, cargo_max, is_active, created_at')
    .eq('id', shipId)
    .eq('profile_id', profileId)
    .maybeSingle()

  if (error) throw new Error(`active ship lookup failed: ${error.message}`)
  return (data as unknown as ActiveShip | null) ?? null
}

/** Der Spieler geht an Bord seines Schiffs (nur am Ort des Schiffs). */
export async function boardPlayerShip(profileId: string, shipId?: string): Promise<{ ok: boolean; shipId: string; location: string; alreadyAboard: boolean }> {
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('noxia_board_ship', { p_profile_id: profileId, p_ship_id: shipId ?? null })
  if (error) throw new Error(error.message)
  const row = data as { ship_id: string; location: string; already_aboard: boolean }
  return { ok: true, shipId: row.ship_id, location: row.location, alreadyAboard: Boolean(row.already_aboard) }
}

/** Wo das eigene Schiff liegt, wenn der Spieler nicht an Bord ist (sonst null). */
export async function parkedShipLocation(profileId: string): Promise<{ shipId: string; location: string } | null> {
  const supabase = createServiceClient()
  const { data: profile } = await supabase.from('profiles').select('aboard_ship_id').eq('id', profileId).maybeSingle()
  if ((profile as { aboard_ship_id?: string | null } | null)?.aboard_ship_id) return null
  const { data } = await supabase.from('ships').select('id, location').eq('profile_id', profileId).order('created_at', { ascending: true }).limit(1).maybeSingle()
  return data ? { shipId: String((data as { id: string }).id), location: String((data as { location: string }).location) } : null
}

function arrivalCoreNotRolledOut(message: string) {
  return message.includes('PGRST202')
    || message.includes('Could not find the function')
    || message.includes('schema cache')
}

async function arrivalStateForShip(shipId: string): Promise<StationArrivalState | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('noxia_get_ship_arrival_state', { p_ship_id: shipId })
  if (error) {
    if (arrivalCoreNotRolledOut(error.message ?? '')) return null
    throw new Error(`arrival state lookup failed: ${error.message}`)
  }
  if (!data) return null
  return data as StationArrivalState
}

// Linienflug-Fahrpreis ohne eigenes Schiff: passengerTicketPrice() in
// lib/game/transfer.ts (gemeinsam mit der Anzeige im Client).

// Oberflächenorte ohne eigene Bahn (z. B. Mishkan Avi auf dem Mars) nutzen die
// Bahn ihres Körpers. Die Zuordnung kommt aus der DB, nicht aus dem Code.
async function registerKnownLocationBodies(supabase: ReturnType<typeof createServiceClient>): Promise<void> {
  const { data } = await supabase.from('locations').select('slug, celestial_body_id, location_type')
  registerLocationBodies((data ?? []) as any[])
}

export async function startPlayerPassengerTransit(profileId: string, destination: string): Promise<AtomicTransitStartResult> {
  const supabase = createServiceClient()
  const profile = await passengerProfile(profileId)
  if (!profile) throw new Error('NOXIA_PROFILE_NOT_FOUND')

  await registerKnownLocationBodies(supabase)
  if (!hasOrbit(profile.current_location) || !hasOrbit(destination)) {
    throw new Error(`NOXIA_TRANSIT_ROUTE_UNKNOWN:${profile.current_location}:${destination}`)
  }

  const { data: tickRow } = await supabase
    .from('tick_log')
    .select('tick_number')
    .order('tick_number', { ascending: false })
    .limit(1)
    .maybeSingle()
  const tick = Number(tickRow?.tick_number ?? 0)

  const playerUnlocks = await getPlayerUnlocks(profileId)
  const navigationProficiency = navigationProficiencyFromUnlocks(playerUnlocks)
  // speedMult=1: Standard-Linienflug-Tempo, kein Bonus durch ein eigenes,
  // schnelleres Schiff -- das bleibt ein Vorteil des Schiffsbesitzes.
  const quote = transferQuote(profile.current_location, destination, tick, {
    speedMult: 1,
    navigationProficiency,
  })
  if (!quote) {
    throw new Error(`NOXIA_TRANSIT_ROUTE_UNKNOWN:${profile.current_location}:${destination}`)
  }

  const ticketPrice = passengerTicketPrice(quote)

  return startPassengerTransitCommand({
    profileId,
    destination,
    durationSeconds: quote.durationSeconds,
    ticketPrice,
  })
}

/**
 * Ticketschalter: Linienflüge vom aktuellen Ort, mit denselben Preisen und
 * Dauern wie beim Abflug (startPlayerPassengerTransit). Wer ein eigenes Schiff
 * hat, fliegt über die Navigation – der Schalter sagt das (hasShip).
 */
export async function getPassengerOffers(profileId: string): Promise<{ from: string | null; hasShip: boolean; parkedAt: string | null; inTransit: boolean; credits: number; offers: PassengerOffer[] }> {
  const supabase = createServiceClient()
  const [ship, profile, { data: wallet }, { data: locations }, { data: tickRow }] = await Promise.all([
    activeShipForProfile(profileId),
    passengerProfile(profileId),
    supabase.from('profiles').select('credits').eq('id', profileId).maybeSingle(),
    supabase.from('locations').select('slug, name, celestial_body_id, location_type'),
    supabase.from('tick_log').select('tick_number').order('tick_number', { ascending: false }).limit(1).maybeSingle(),
  ])
  if (!profile) throw new Error('NOXIA_PROFILE_NOT_FOUND')
  registerLocationBodies((locations ?? []) as Parameters<typeof registerLocationBodies>[0])
  // Der Ort des Spielers: an Bord der des Schiffs (folgt ihm), sonst der eigene.
  const from = ship ? ship.location : profile.current_location
  const inTransit = ship ? ship.status === 'transit' : Boolean(profile.transit_destination)
  const parked = ship ? null : await parkedShipLocation(profileId)
  const navigationProficiency = navigationProficiencyFromUnlocks(await getPlayerUnlocks(profileId))
  const offers = from ? passengerOffers({ from, destinations: (locations ?? []) as Array<{ slug: string; name: string | null }>, tick: Number(tickRow?.tick_number ?? 0), navigationProficiency }) : []
  return { from, hasShip: Boolean(ship), parkedAt: parked?.location ?? null, inTransit, credits: Number(wallet?.credits ?? 0), offers }
}

async function quoteForShip(profileId: string, ship: ActiveShip, destination: string) {
  const supabase = createServiceClient()
  await registerKnownLocationBodies(supabase)
  if (!hasOrbit(ship.location) || !hasOrbit(destination)) {
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

  // Navigation knowledge is read from persisted player_unlocks on the server.
  // Client values can preview the quote, but can never grant themselves a
  // cheaper transfer. Missing/failed unlock lookup naturally fails closed to 0.
  const playerUnlocks = await getPlayerUnlocks(profileId)
  const navigationProficiency = navigationProficiencyFromUnlocks(playerUnlocks)
  const quote = transferQuote(ship.location, destination, tick, {
    speedMult,
    navigationProficiency,
  })
  if (!quote) {
    throw new Error(`NOXIA_TRANSIT_ROUTE_UNKNOWN:${ship.location}:${destination}`)
  }

  const rangeDistance = Number((shipType as any)?.range_distance ?? Number.POSITIVE_INFINITY)
  if (Number.isFinite(rangeDistance) && quote.distance > rangeDistance) {
    throw new Error(`NOXIA_TRANSIT_OUT_OF_RANGE:${quote.distance}:${rangeDistance}`)
  }

  return { quote, tick }
}

export async function startPlayerTransit(profileId: string, destination: string): Promise<AtomicTransitStartResult> {
  const supabase = createServiceClient()
  const ship = await activeShipForProfile(profileId)
  if (!ship) return startPlayerPassengerTransit(profileId, destination)

  if (ship.status === 'transit' && ship.dest_location !== destination) {
    throw new Error(`NOXIA_TRANSIT_ALREADY_ACTIVE:${ship.dest_location ?? '<unknown>'}`)
  }
  const { quote, tick } = await quoteForShip(profileId, ship, destination)

  // Ohne eigene Flugausbildung fliegt ein angeheuerter Pilot. Abgeleitet aus
  // dem Lernjournal; schlägt die Abfrage fehl, gilt der Spieler als ungeschult.
  const { data: completedModules } = await supabase
    .from('player_learning_progress')
    .select('module_id')
    .eq('profile_id', profileId)
    .eq('completed', true)
  const trained = hasPilotTraining((completedModules ?? []).map((m: any) => String(m.module_id)))

  return startTransitCommand({
    profileId,
    destination,
    durationSeconds: quote.durationSeconds,
    energyNeeded: quote.energy,
    dockingIdleHours: DOCKING_IDLE_EXPIRE_HOURS,
    pilotFee: pilotFee(quote, trained, tick),
  })
}

export async function completePlayerTransit(profileId: string): Promise<AtomicTransitCompletionResult | null> {
  const ship = await activeShipForProfile(profileId)
  if (!ship) {
    const profile = await passengerProfile(profileId)
    if (!profile || !profile.transit_destination) return null
    return completePassengerTransitCommand(profileId)
  }
  if (ship.status !== 'transit') return null
  return completeTransitCommand(ship.id)
}

export async function settleDuePlayerTransit(profileId: string): Promise<AtomicTransitCompletionResult | null> {
  await settleDueParkedShips(profileId).catch(() => 0)
  const ship = await activeShipForProfile(profileId)
  if (!ship) {
    const profile = await passengerProfile(profileId)
    if (!profile || !profile.transit_destination || !profile.transit_arrives_at) return null
    if (new Date(profile.transit_arrives_at).getTime() > Date.now()) return null
    return completePassengerTransitCommand(profileId)
  }
  if (ship.status !== 'transit' || !ship.arrives_at) return null
  if (new Date(ship.arrives_at).getTime() > Date.now()) return null
  return completeTransitCommand(ship.id)
}

export async function getPlayerTransitState(profileId: string): Promise<PlayerTransitState | null> {
  await settleDuePlayerTransit(profileId)
  const ship = await activeShipForProfile(profileId)

  if (!ship) {
    // Spediteur-Pfad ohne eigenes Schiff: Reisezustand liegt auf profiles.
    const profile = await passengerProfile(profileId)
    if (!profile) return null

    if (!profile.transit_destination || !profile.transit_arrives_at) {
      return {
        shipId: 'passenger',
        status: 'docked',
        location: profile.current_location,
        from: null,
        to: null,
        departedAt: null,
        arrivesAt: null,
        totalSeconds: 0,
        remainingSeconds: 0,
        arrival: null,
      }
    }

    const arrivesMs = new Date(profile.transit_arrives_at).getTime()
    const departedMs = profile.transit_departed_at ? new Date(profile.transit_departed_at).getTime() : Date.now()
    const totalSeconds = Math.max(1, Math.round((arrivesMs - departedMs) / 1000))
    const remainingSeconds = Math.max(0, Math.ceil((arrivesMs - Date.now()) / 1000))

    return {
      shipId: 'passenger',
      status: 'transit',
      location: profile.current_location,
      from: profile.current_location,
      to: profile.transit_destination,
      departedAt: profile.transit_departed_at,
      arrivesAt: profile.transit_arrives_at,
      totalSeconds,
      remainingSeconds,
      arrival: null,
    }
  }

  if (ship.status !== 'transit' || !ship.dest_location || !ship.arrives_at) {
    const arrival = await arrivalStateForShip(ship.id)
    return {
      shipId: ship.id,
      status: arrival?.phase ?? 'docked',
      location: ship.location,
      from: null,
      to: null,
      departedAt: null,
      arrivesAt: null,
      totalSeconds: 0,
      remainingSeconds: 0,
      arrival,
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
    arrival: null,
  }
}

/**
 * Schiff mit angeheuertem Piloten losschicken, ohne selbst an Bord zu sein
 * (Migration 20261106010000). Das Schiff muss am Ort des Spielers liegen; das
 * Honorar fällt immer an, weil nicht der Spieler fliegt.
 */
export async function dispatchParkedShip(profileId: string, destination: string, shipId?: string, pilotIndex = 1): Promise<AtomicTransitStartResult> {
  const supabase = createServiceClient()
  const { data: profile } = await supabase.from('profiles').select('aboard_ship_id, current_location').eq('id', profileId).maybeSingle()
  if (!profile) throw new Error('NOXIA_PROFILE_NOT_FOUND')
  const aboard = (profile as { aboard_ship_id?: string | null }).aboard_ship_id
  let query = supabase
    .from('ships')
    .select('id, profile_id, location, status, dest_location, arrives_at, transit_started_at, ship_type_id, cargo_max, is_active, created_at')
    .eq('profile_id', profileId)
    .eq('location', (profile as { current_location: string }).current_location)
    .eq('status', 'docked')
  if (shipId) query = query.eq('id', shipId)
  if (aboard) query = query.neq('id', aboard)
  const { data: ships, error } = await query.order('created_at', { ascending: true }).limit(1)
  if (error) throw new Error(`dispatch ship lookup failed: ${error.message}`)
  const ship = (ships?.[0] as unknown as ActiveShip | undefined)
  if (!ship) throw new Error(aboard && (!shipId || shipId === aboard) ? 'NOXIA_DISPATCH_PLAYER_ABOARD' : 'NOXIA_SHIP_NOT_FOUND')

  const { quote } = await quoteForShip(profileId, ship, destination)
  const pilot = pilotByIndex(ship.id, ship.location, pilotDay(), pilotIndex)
  if (!pilot) throw new Error('NOXIA_PILOT_NOT_FOUND')
  const { data, error: rpcError } = await supabase.rpc('noxia_dispatch_ship', {
    p_profile_id: profileId,
    p_ship_id: ship.id,
    p_destination_slug: destination,
    p_duration_seconds: quote.durationSeconds,
    p_energy_needed: quote.energy,
    p_docking_idle_hours: DOCKING_IDLE_EXPIRE_HOURS,
    p_pilot_fee: hiredPilotFee(quote, pilot),
  })
  if (rpcError) throw new Error(rpcError.message)
  return { ...(data as AtomicTransitStartResult), pilot_name: pilot.name } as AtomicTransitStartResult
}

/** Schiffe ohne Spieler an Bord, deren Flug fällig ist, landen lassen. */
export async function settleDueParkedShips(profileId: string): Promise<number> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('ships')
    .select('id')
    .eq('profile_id', profileId)
    .eq('status', 'transit')
    .lte('arrives_at', new Date().toISOString())
  let landed = 0
  for (const row of data ?? []) {
    await completeTransitCommand(String((row as { id: string }).id))
    landed++
  }
  return landed
}

export type FleetShip = {
  id: string
  name: string | null
  shipTypeId: string | null
  location: string
  status: string
  destination: string | null
  arrivesAt: string | null
  aboard: boolean
  /** Am Ort des Spielers angedockt und nicht an Bord: kann mit Pilot losgeschickt werden. */
  canDispatch: boolean
  cargo: Array<{ resource: string; amount: number }>
  pilots: HiredPilot[]
}

/** Alle eigenen Schiffe mit Ladung und den heute verfügbaren Piloten. */
export async function getFleet(profileId: string): Promise<{ location: string | null; ships: FleetShip[] }> {
  await settleDueParkedShips(profileId).catch(() => 0)
  const supabase = createServiceClient()
  const { data: profile } = await supabase.from('profiles').select('aboard_ship_id, current_location').eq('id', profileId).maybeSingle()
  if (!profile) return { location: null, ships: [] }
  const aboardId = (profile as { aboard_ship_id?: string | null }).aboard_ship_id ?? null
  const { data: ships } = await supabase
    .from('ships')
    .select('id, name, ship_type_id, location, status, dest_location, arrives_at')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: true })
  const ids = (ships ?? []).map(s => String((s as { id: string }).id))
  const { data: cargoRows } = ids.length
    ? await supabase.from('ship_cargo').select('ship_id, resource, amount').in('ship_id', ids)
    : { data: [] }
  const day = pilotDay()
  // Spieler an Bord: sein Ort ist der des Schiffs (current_location folgt per Trigger).
  const here = String((profile as { current_location: string }).current_location)
  return {
    location: here,
    ships: (ships ?? []).map(row => {
      const s = row as { id: string; name: string | null; ship_type_id: string | null; location: string; status: string; dest_location: string | null; arrives_at: string | null }
      const aboard = s.id === aboardId
      return {
        id: s.id,
        name: s.name,
        shipTypeId: s.ship_type_id,
        location: s.location,
        status: s.status,
        destination: s.dest_location,
        arrivesAt: s.arrives_at,
        aboard,
        canDispatch: !aboard && s.status === 'docked' && s.location === here,
        cargo: (cargoRows ?? []).filter(c => (c as { ship_id: string }).ship_id === s.id && Number((c as { amount: number }).amount) > 0)
          .map(c => ({ resource: String((c as { resource: string }).resource), amount: Number((c as { amount: number }).amount) })),
        pilots: availablePilots(s.id, s.location, day),
      }
    }),
  }
}
