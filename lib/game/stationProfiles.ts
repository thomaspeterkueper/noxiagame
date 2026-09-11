// lib/game/stationProfiles.ts
// Canonical gameplay-facing station roles and service semantics.
//
// This file intentionally does NOT implement inventories, docking state or
// market transactions. It tells UI and orchestration layers what a station is
// allowed to expose while the shared Core remains responsible for persistence
// and commands.

export type StationRole =
  | 'habitat-transfer-station'
  | 'free-port'
  | 'orbital-depot'

export type StationMarketMode = 'local-node' | 'station-market' | 'none'
export type StationDepotMode = 'persistent-node' | 'station-storage' | 'none'

export interface StationServiceProfile {
  slug: string
  role: StationRole
  roleLabel: string
  freePort: boolean
  docking: boolean
  cargoTransfer: boolean
  depotMode: StationDepotMode
  marketMode: StationMarketMode
  onwardTransfer: boolean
  summary: string
}

/**
 * Explicit station profiles. Unknown station slugs receive a conservative
 * generic profile so existing stations keep working without silently becoming
 * Free Ports.
 */
export const STATION_SERVICE_PROFILES: Readonly<Record<string, StationServiceProfile>> = {
  phobos: {
    slug: 'phobos',
    role: 'free-port',
    roleLabel: 'FREE PORT · DEPOT · MARKET HUB',
    freePort: true,
    docking: true,
    cargoTransfer: true,
    depotMode: 'persistent-node',
    marketMode: 'local-node',
    onwardTransfer: true,
    summary: 'Neutraler orbitaler Umschlagknoten mit persistentem Depot, lokalem Markt und Weitertransport. Docking und Frachttransfer bleiben getrennte Vorgänge.',
  },
  // `prometheus` is the current legacy runtime slug for Kepler Station.
  prometheus: {
    slug: 'prometheus',
    role: 'habitat-transfer-station',
    roleLabel: 'HABITAT · TRANSFER STATION',
    freePort: false,
    docking: true,
    cargoTransfer: true,
    depotMode: 'station-storage',
    marketMode: 'station-market',
    onwardTransfer: true,
    summary: 'Bewohnte Transferstation mit Docking, Stationslager und lokalem Handel. Kein Free Port.',
  },
  kepler: {
    slug: 'kepler',
    role: 'habitat-transfer-station',
    roleLabel: 'HABITAT · TRANSFER STATION',
    freePort: false,
    docking: true,
    cargoTransfer: true,
    depotMode: 'station-storage',
    marketMode: 'station-market',
    onwardTransfer: true,
    summary: 'Bewohnte Transferstation mit Docking, Stationslager und lokalem Handel. Kein Free Port.',
  },
}

const GENERIC_STATION_PROFILE: StationServiceProfile = {
  slug: 'generic',
  role: 'habitat-transfer-station',
  roleLabel: 'ORBITAL STATION',
  freePort: false,
  docking: true,
  cargoTransfer: true,
  depotMode: 'station-storage',
  marketMode: 'station-market',
  onwardTransfer: true,
  summary: 'Orbitale Station mit Docking-, Lager- und Transferdiensten.',
}

export function getStationServiceProfile(slug: string): StationServiceProfile {
  return STATION_SERVICE_PROFILES[slug] ?? { ...GENERIC_STATION_PROFILE, slug }
}

export function isFreePortStation(slug: string): boolean {
  return getStationServiceProfile(slug).freePort
}
