// lib/game/docking.ts
// Canonical NOXIA docking semantics for orbital stations and depots.
//
// IMPORTANT: Docking establishes a physical berth/connection only.
// It never moves cargo, changes ownership or executes a market transaction.
// Persistence and commands belong to the shared Core.

export type DockingPortClass =
  | 'shuttle'
  | 'standard'
  | 'heavy'
  | 'service'

export type DockingPortStatus =
  | 'available'
  | 'reserved'
  | 'occupied'
  | 'offline'

export type DockingConnectionStatus =
  | 'approaching'
  | 'docked'
  | 'departing'
  | 'released'

export type DockingVesselClass =
  | 'surface-transfer-shuttle'
  | 'intersolar-standard'
  | 'intersolar-heavy'
  | 'service-craft'

export interface DockingPort {
  id: string
  stationSlug: string
  label: string
  portClass: DockingPortClass
  status: DockingPortStatus
  occupiedByVesselId?: string | null
  reservedForVesselId?: string | null
}

export interface DockingVessel {
  id: string
  vesselClass: DockingVesselClass
  locationSlug: string
}

export interface DockingConnection {
  id: string
  stationSlug: string
  portId: string
  vesselId: string
  status: DockingConnectionStatus
}

const PORT_COMPATIBILITY: Readonly<Record<DockingVesselClass, readonly DockingPortClass[]>> = {
  'surface-transfer-shuttle': ['shuttle', 'standard', 'service'],
  'intersolar-standard': ['standard', 'heavy'],
  'intersolar-heavy': ['heavy'],
  'service-craft': ['service', 'shuttle', 'standard'],
}

export function isPortCompatible(
  vesselClass: DockingVesselClass,
  portClass: DockingPortClass,
): boolean {
  return PORT_COMPATIBILITY[vesselClass].includes(portClass)
}

export function canReservePort(port: DockingPort, vessel: DockingVessel): boolean {
  return port.stationSlug === vessel.locationSlug
    && port.status === 'available'
    && isPortCompatible(vessel.vesselClass, port.portClass)
}

export function canDockAtPort(port: DockingPort, vessel: DockingVessel): boolean {
  if (port.stationSlug !== vessel.locationSlug) return false
  if (!isPortCompatible(vessel.vesselClass, port.portClass)) return false
  if (port.status === 'available') return true
  if (port.status === 'reserved') return port.reservedForVesselId === vessel.id
  return false
}

export function reservePort(port: DockingPort, vessel: DockingVessel): DockingPort {
  if (!canReservePort(port, vessel)) {
    throw new Error(`Docking port ${port.id} cannot be reserved for vessel ${vessel.id}.`)
  }
  return {
    ...port,
    status: 'reserved',
    reservedForVesselId: vessel.id,
    occupiedByVesselId: null,
  }
}

export function occupyPort(port: DockingPort, vessel: DockingVessel): DockingPort {
  if (!canDockAtPort(port, vessel)) {
    throw new Error(`Vessel ${vessel.id} cannot dock at port ${port.id}.`)
  }
  return {
    ...port,
    status: 'occupied',
    occupiedByVesselId: vessel.id,
    reservedForVesselId: null,
  }
}

export function releasePort(port: DockingPort, vesselId: string): DockingPort {
  if (port.status !== 'occupied' || port.occupiedByVesselId !== vesselId) {
    throw new Error(`Vessel ${vesselId} does not occupy port ${port.id}.`)
  }
  return {
    ...port,
    status: 'available',
    occupiedByVesselId: null,
    reservedForVesselId: null,
  }
}

/**
 * Cargo operations require an established docking connection, but docking alone
 * never starts or authorises a cargo move. Ownership/capacity/transfer checks
 * remain separate Core responsibilities.
 */
export function providesPhysicalCargoConnection(connection: DockingConnection): boolean {
  return connection.status === 'docked'
}
