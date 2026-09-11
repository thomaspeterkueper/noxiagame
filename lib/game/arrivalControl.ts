// lib/game/arrivalControl.ts
// Canonical arrival-control semantics between intersolar transit and docking.
//
// IMPORTANT:
// - A vessel that has reached a station node is not automatically docked.
// - Holding is a rendezvous/traffic-control state, not a physical orbit around
//   the station body and not a cargo-transfer state.
// - Persistence and authoritative queue assignment belong to the shared Core.

import type { DockingPortClass, DockingVesselClass } from './docking'

export type ArrivalControlPhase =
  | 'intersolar-transit'
  | 'arrival-rendezvous'
  | 'holding'
  | 'approach'
  | 'docked'
  | 'departing'

export type HoldingReason =
  | 'no-compatible-port'
  | 'compatible-ports-busy'
  | 'awaiting-reservation'
  | 'traffic-separation'
  | 'station-closed'

export type HoldingZoneClass =
  | 'light-traffic'
  | 'standard-traffic'
  | 'heavy-traffic'

export interface HoldingZoneDefinition {
  id: string
  stationSlug: string
  label: string
  zoneClass: HoldingZoneClass
  maxConcurrent: number
  note: string
}

export interface ArrivalQueueEntry {
  vesselId: string
  vesselClass: DockingVesselClass
  stationSlug: string
  phase: Extract<ArrivalControlPhase, 'arrival-rendezvous' | 'holding' | 'approach'>
  holdingReason?: HoldingReason | null
  holdingZoneId?: string | null
  targetPortId?: string | null
  targetPortClass?: DockingPortClass | null
  queueEnteredAt?: string | null
  queuePosition?: number | null
}

export const STATION_HOLDING_ZONES: Readonly<Record<string, readonly HoldingZoneDefinition[]>> = {
  phobos: [
    {
      id: 'phobos-h-light',
      stationSlug: 'phobos',
      label: 'H-LIGHT',
      zoneClass: 'light-traffic',
      maxConcurrent: 4,
      note: 'Rendezvous-/Holding-Korridor für Transfer-Shuttles und Servicefahrzeuge im Phobos-/Mars-Bezugssystem.',
    },
    {
      id: 'phobos-h-standard',
      stationSlug: 'phobos',
      label: 'H-STANDARD',
      zoneClass: 'standard-traffic',
      maxConcurrent: 6,
      note: 'Standard-Holding für intersolare Frachter vor Portzuweisung.',
    },
    {
      id: 'phobos-h-heavy',
      stationSlug: 'phobos',
      label: 'H-HEAVY',
      zoneClass: 'heavy-traffic',
      maxConcurrent: 2,
      note: 'Separater Heavy-Traffic-Holding-Korridor für große Frachter und Pioneer-Rahmen.',
    },
  ],
  prometheus: [
    {
      id: 'kepler-h-standard',
      stationSlug: 'prometheus',
      label: 'H-STANDARD',
      zoneClass: 'standard-traffic',
      maxConcurrent: 4,
      note: 'Rendezvous-Holding im lokalen Kepler-Transferraum vor Dockingfreigabe.',
    },
  ],
  kepler: [
    {
      id: 'kepler-h-standard',
      stationSlug: 'kepler',
      label: 'H-STANDARD',
      zoneClass: 'standard-traffic',
      maxConcurrent: 4,
      note: 'Rendezvous-Holding im lokalen Kepler-Transferraum vor Dockingfreigabe.',
    },
  ],
}

export function holdingZoneClassForVessel(vesselClass: DockingVesselClass): HoldingZoneClass {
  if (vesselClass === 'intersolar-heavy') return 'heavy-traffic'
  if (vesselClass === 'intersolar-standard') return 'standard-traffic'
  return 'light-traffic'
}

export function preferredHoldingZone(
  stationSlug: string,
  vesselClass: DockingVesselClass,
): HoldingZoneDefinition | null {
  const zones = STATION_HOLDING_ZONES[stationSlug] ?? []
  const wanted = holdingZoneClassForVessel(vesselClass)
  return zones.find(zone => zone.zoneClass === wanted)
    ?? zones.find(zone => zone.zoneClass === 'standard-traffic')
    ?? zones[0]
    ?? null
}

export function canEnterApproach(entry: ArrivalQueueEntry): boolean {
  return entry.phase === 'holding' && Boolean(entry.targetPortId)
}

export function hasPhysicalDockingConnection(phase: ArrivalControlPhase): boolean {
  return phase === 'docked'
}

export function canTransferCargoInArrivalPhase(phase: ArrivalControlPhase): boolean {
  return hasPhysicalDockingConnection(phase)
}
