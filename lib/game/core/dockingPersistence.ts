import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'

export type PersistentDockingPortClass = 'shuttle' | 'standard' | 'heavy' | 'service'
export type PersistentDockingPortStatus = 'available' | 'reserved' | 'occupied' | 'offline'

export type DockingPortState = {
  id: string
  stationSlug: string
  label: string
  portClass: PersistentDockingPortClass
  role: string
  cargoEnabled: boolean
  crewEnabled: boolean
  status: PersistentDockingPortStatus
  reservedForVesselId: string | null
  occupiedByVesselId: string | null
  reservationExpiresAt: string | null
  connectionId: string | null
}

export type DockingConnection = {
  id: string
  port_id: string
  ship_id: string
  actor_profile_id: string
  status: 'docked' | 'released'
  docked_at: string
  released_at: string | null
}

function commandError(command: string, error: { message?: string; code?: string; details?: string | null }) {
  const suffix = [error.code, error.message, error.details].filter(Boolean).join(' · ')
  return new Error(`${command} failed${suffix ? `: ${suffix}` : ''}`)
}

export function canonicalDockingStationSlug(slug: string): string {
  return slug.toLowerCase() === 'kepler' ? 'prometheus' : slug.toLowerCase()
}

export async function listDockingPortStates(stationSlug: string): Promise<DockingPortState[]> {
  const supabase = createServiceClient()
  const canonical = canonicalDockingStationSlug(stationSlug)

  // Expiry is a Core concern. Running it before a state query keeps the projection
  // honest even when no dedicated cleanup scheduler has run recently.
  const { error: cleanupError } = await supabase.rpc('noxia_cleanup_expired_docking_reservations')
  if (cleanupError) throw commandError('noxia_cleanup_expired_docking_reservations', cleanupError)

  const { data: ports, error: portsError } = await supabase
    .from('docking_ports')
    .select('id,station_slug,label,port_class,role,cargo_enabled,crew_enabled,offline')
    .eq('station_slug', canonical)
    .order('id')
  if (portsError) throw commandError('docking port query', portsError)

  const portIds = (ports ?? []).map(port => port.id)
  if (portIds.length === 0) return []

  const [{ data: reservations, error: reservationError }, { data: connections, error: connectionError }] = await Promise.all([
    supabase
      .from('docking_reservations')
      .select('port_id,ship_id,expires_at')
      .in('port_id', portIds)
      .eq('status', 'active'),
    supabase
      .from('docking_connections')
      .select('id,port_id,ship_id')
      .in('port_id', portIds)
      .eq('status', 'docked'),
  ])
  if (reservationError) throw commandError('docking reservation query', reservationError)
  if (connectionError) throw commandError('docking connection query', connectionError)

  const reservationByPort = new Map((reservations ?? []).map(row => [row.port_id, row]))
  const connectionByPort = new Map((connections ?? []).map(row => [row.port_id, row]))

  return (ports ?? []).map(port => {
    const reservation = reservationByPort.get(port.id)
    const connection = connectionByPort.get(port.id)
    const status: PersistentDockingPortStatus = port.offline
      ? 'offline'
      : connection
        ? 'occupied'
        : reservation
          ? 'reserved'
          : 'available'

    return {
      id: port.id,
      stationSlug: port.station_slug,
      label: port.label,
      portClass: port.port_class as PersistentDockingPortClass,
      role: port.role,
      cargoEnabled: port.cargo_enabled,
      crewEnabled: port.crew_enabled,
      status,
      reservedForVesselId: reservation?.ship_id ?? null,
      occupiedByVesselId: connection?.ship_id ?? null,
      reservationExpiresAt: reservation?.expires_at ?? null,
      connectionId: connection?.id ?? null,
    }
  })
}

export async function getActiveDockingConnection(profileId: string, shipId: string): Promise<DockingConnection | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('docking_connections')
    .select('id,port_id,ship_id,actor_profile_id,status,docked_at,released_at')
    .eq('ship_id', shipId)
    .eq('actor_profile_id', profileId)
    .eq('status', 'docked')
    .maybeSingle()
  if (error) throw commandError('active docking connection query', error)
  return data as DockingConnection | null
}

export async function reserveDockingPort(input: {
  commandId: string
  actorProfileId: string
  shipId: string
  portId: string
  expiresAt?: string | null
}) {
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('noxia_reserve_docking_port', {
    p_command_id: input.commandId,
    p_actor_profile_id: input.actorProfileId,
    p_ship_id: input.shipId,
    p_port_id: input.portId,
    p_expires_at: input.expiresAt ?? null,
  })
  if (error) throw commandError('noxia_reserve_docking_port', error)
  return data
}

export async function dockVessel(input: {
  commandId: string
  actorProfileId: string
  shipId: string
  portId: string
}) {
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('noxia_dock_vessel', {
    p_command_id: input.commandId,
    p_actor_profile_id: input.actorProfileId,
    p_ship_id: input.shipId,
    p_port_id: input.portId,
  })
  if (error) throw commandError('noxia_dock_vessel', error)
  return data
}

export async function undockVessel(input: {
  commandId: string
  actorProfileId: string
  shipId: string
  portId: string
}) {
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('noxia_undock_vessel', {
    p_command_id: input.commandId,
    p_actor_profile_id: input.actorProfileId,
    p_ship_id: input.shipId,
    p_port_id: input.portId,
  })
  if (error) throw commandError('noxia_undock_vessel', error)
  return data
}

export async function cancelDockingReservation(input: {
  commandId: string
  actorProfileId: string
  shipId: string
  portId: string
}) {
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('noxia_cancel_docking_reservation', {
    p_command_id: input.commandId,
    p_actor_profile_id: input.actorProfileId,
    p_ship_id: input.shipId,
    p_port_id: input.portId,
  })
  if (error) throw commandError('noxia_cancel_docking_reservation', error)
  return data
}
