// lib/game/stationDockingTopologies.ts
// Canonical station-level docking infrastructure built on the shared docking model.
//
// These are gameplay-facing physical port layouts. They do not persist occupancy;
// Core owns runtime docking state and commands.

import type { DockingPort, DockingPortClass } from './docking'

export type DockingPortOperationalRole =
  | 'shuttle-handover'
  | 'general-cargo'
  | 'heavy-freighter'
  | 'service-maintenance'
  | 'crew-passenger'

export interface StationDockingPortDefinition {
  id: string
  label: string
  portClass: DockingPortClass
  role: DockingPortOperationalRole
  cargoEnabled: boolean
  crewEnabled: boolean
  note: string
}

export interface StationDockingTopology {
  stationSlug: string
  topologyLabel: string
  ports: readonly StationDockingPortDefinition[]
}

export const STATION_DOCKING_TOPOLOGIES: Readonly<Record<string, StationDockingTopology>> = {
  phobos: {
    stationSlug: 'phobos',
    topologyLabel: 'PHOBOS FREE PORT · PORT RING A',
    ports: [
      {
        id: 'phobos-a1',
        label: 'A1 Shuttle Handover',
        portClass: 'shuttle',
        role: 'shuttle-handover',
        cargoEnabled: true,
        crewEnabled: true,
        note: 'Primary transfer-shuttle berth for Mars/Phobos local handover traffic.',
      },
      {
        id: 'phobos-a2',
        label: 'A2 Shuttle / Service',
        portClass: 'shuttle',
        role: 'service-maintenance',
        cargoEnabled: true,
        crewEnabled: true,
        note: 'Flexible berth for transfer shuttles and service craft.',
      },
      {
        id: 'phobos-b1',
        label: 'B1 General Cargo',
        portClass: 'standard',
        role: 'general-cargo',
        cargoEnabled: true,
        crewEnabled: true,
        note: 'Standard intersolar freighter berth with depot access.',
      },
      {
        id: 'phobos-b2',
        label: 'B2 General Cargo',
        portClass: 'standard',
        role: 'general-cargo',
        cargoEnabled: true,
        crewEnabled: true,
        note: 'Second standard berth for parallel cargo handling.',
      },
      {
        id: 'phobos-c1',
        label: 'C1 Heavy Cargo',
        portClass: 'heavy',
        role: 'heavy-freighter',
        cargoEnabled: true,
        crewEnabled: true,
        note: 'Heavy-freighter berth for high-volume interplanetary traffic.',
      },
      {
        id: 'phobos-s1',
        label: 'S1 Service Dock',
        portClass: 'service',
        role: 'service-maintenance',
        cargoEnabled: false,
        crewEnabled: true,
        note: 'Maintenance, inspection and tug/service-craft berth. No commercial cargo transfer.',
      },
    ],
  },
  prometheus: {
    stationSlug: 'prometheus',
    topologyLabel: 'KEPLER STATION · PRIMARY DOCK',
    ports: [
      {
        id: 'kepler-a1',
        label: 'A1 Shuttle / Crew',
        portClass: 'shuttle',
        role: 'crew-passenger',
        cargoEnabled: true,
        crewEnabled: true,
        note: 'Primary habitat access for shuttle, crew and light cargo.',
      },
      {
        id: 'kepler-b1',
        label: 'B1 Transfer Berth',
        portClass: 'standard',
        role: 'general-cargo',
        cargoEnabled: true,
        crewEnabled: true,
        note: 'Standard transfer berth for intersolar traffic.',
      },
      {
        id: 'kepler-s1',
        label: 'S1 Service Dock',
        portClass: 'service',
        role: 'service-maintenance',
        cargoEnabled: false,
        crewEnabled: true,
        note: 'Service and maintenance berth.',
      },
    ],
  },
  kepler: {
    stationSlug: 'kepler',
    topologyLabel: 'KEPLER STATION · PRIMARY DOCK',
    ports: [
      {
        id: 'kepler-a1',
        label: 'A1 Shuttle / Crew',
        portClass: 'shuttle',
        role: 'crew-passenger',
        cargoEnabled: true,
        crewEnabled: true,
        note: 'Primary habitat access for shuttle, crew and light cargo.',
      },
      {
        id: 'kepler-b1',
        label: 'B1 Transfer Berth',
        portClass: 'standard',
        role: 'general-cargo',
        cargoEnabled: true,
        crewEnabled: true,
        note: 'Standard transfer berth for intersolar traffic.',
      },
      {
        id: 'kepler-s1',
        label: 'S1 Service Dock',
        portClass: 'service',
        role: 'service-maintenance',
        cargoEnabled: false,
        crewEnabled: true,
        note: 'Service and maintenance berth.',
      },
    ],
  },
}

export function getStationDockingTopology(stationSlug: string): StationDockingTopology | null {
  return STATION_DOCKING_TOPOLOGIES[stationSlug] ?? null
}

export function createInitialDockingPorts(stationSlug: string): DockingPort[] {
  const topology = getStationDockingTopology(stationSlug)
  if (!topology) return []

  return topology.ports.map(port => ({
    id: port.id,
    stationSlug,
    label: port.label,
    portClass: port.portClass,
    status: 'available',
    occupiedByVesselId: null,
    reservedForVesselId: null,
  }))
}

export function stationHasCargoCapablePort(stationSlug: string): boolean {
  return getStationDockingTopology(stationSlug)?.ports.some(port => port.cargoEnabled) ?? false
}

export function stationHasHeavyFreighterPort(stationSlug: string): boolean {
  return getStationDockingTopology(stationSlug)?.ports.some(port => port.portClass === 'heavy') ?? false
}
