// lib/game/worldDevelopmentSignals.ts
// Read-only adapters from existing NOXIA truth into World Development signals.
//
// These functions never mutate runtime state and never invent authority. If the
// available source data cannot support a driver, the caller must leave that
// driver unresolved instead of manufacturing a value.

import type { WorldDevelopmentSignal } from './worldDevelopment'
import { getStationServiceProfile, STATION_SERVICE_PROFILES } from './stationProfiles'
import { getStationDockingTopology } from './stationDockingTopologies'

export interface ResourceBalanceSnapshot {
  stock: number
  production: number
  consumption: number
}

export interface FirmEnergySnapshot {
  storedEnergy: number
  firmProduction: number
  demand: number
}

export interface OrbitalStationCapabilitySnapshot {
  slug: string
  cargoPortCount: number
  heavyPortCount: number
  servicePortCount: number
  hasDepot: boolean
  onwardTransfer: boolean
}

export interface DerivedWorldDevelopmentSignal {
  signal: WorldDevelopmentSignal
  explanation: string
  evidence: Record<string, number | string | boolean>
}

function nonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

/**
 * Turns a stock/production/consumption balance into a conservative security
 * score. A structurally deficit flow can never become "strong" merely because
 * a large temporary stock exists; sustainable production is kept distinct
 * from buffer coverage.
 */
export function deriveBufferedResourceSecurity(snapshot: ResourceBalanceSnapshot): {
  value: number
  sustainable: boolean
  stockCoverageTicks: number | null
  deficitCoverageTicks: number | null
} | null {
  const stock = nonNegative(snapshot.stock)
  const production = nonNegative(snapshot.production)
  const consumption = nonNegative(snapshot.consumption)

  if (stock === 0 && production === 0 && consumption === 0) return null

  if (consumption === 0) {
    return {
      value: stock > 0 || production > 0 ? 1 : 0,
      sustainable: production > 0,
      stockCoverageTicks: null,
      deficitCoverageTicks: null,
    }
  }

  const stockCoverageTicks = stock / consumption
  if (production >= consumption) {
    // Balanced/surplus production establishes the sustainable baseline. A
    // buffer of four consumption ticks raises the score from 0.75 to 1.0.
    return {
      value: clamp01(0.75 + 0.25 * Math.min(stockCoverageTicks / 4, 1)),
      sustainable: true,
      stockCoverageTicks,
      deficitCoverageTicks: null,
    }
  }

  const deficit = consumption - production
  const deficitCoverageTicks = deficit > 0 ? stock / deficit : null
  const productionShare = clamp01(production / consumption)
  const bufferShare = clamp01((deficitCoverageTicks ?? 0) / 8)

  return {
    // A finite buffer may make a deficit manageable, but not structurally
    // strong. 0.74 is intentionally below the World Development strong band.
    value: Math.min(0.74, 0.55 * productionShare + 0.45 * bufferShare),
    sustainable: false,
    stockCoverageTicks,
    deficitCoverageTicks,
  }
}

export function deriveWaterSecuritySignal(
  snapshot: ResourceBalanceSnapshot,
  sourceRef: string,
): DerivedWorldDevelopmentSignal | null {
  const security = deriveBufferedResourceSecurity(snapshot)
  if (!security) return null

  return {
    signal: {
      driverId: 'water_security',
      value: security.value,
      sourceRef,
    },
    explanation: security.sustainable
      ? 'Water production meets current demand; stored water provides additional resilience.'
      : 'Water demand exceeds production; security depends on the remaining buffer.',
    evidence: {
      stock: nonNegative(snapshot.stock),
      production: nonNegative(snapshot.production),
      consumption: nonNegative(snapshot.consumption),
      sustainable: security.sustainable,
      stockCoverageTicks: security.stockCoverageTicks ?? 'n/a',
      deficitCoverageTicks: security.deficitCoverageTicks ?? 'n/a',
    },
  }
}

/**
 * Firm energy requires an explicit firm/dispatchable production input. Generic
 * `location_resources.energy.production` is deliberately not accepted here as
 * proof of firm capacity because it may include intermittent generation.
 */
export function deriveFirmEnergySignal(
  snapshot: FirmEnergySnapshot,
  sourceRef: string,
): DerivedWorldDevelopmentSignal | null {
  const security = deriveBufferedResourceSecurity({
    stock: snapshot.storedEnergy,
    production: snapshot.firmProduction,
    consumption: snapshot.demand,
  })
  if (!security) return null

  return {
    signal: {
      driverId: 'firm_energy',
      value: security.value,
      sourceRef,
    },
    explanation: security.sustainable
      ? 'Firm generation covers current demand; stored energy adds reserve depth.'
      : 'Firm generation is below demand; reliable operation depends on stored reserves.',
    evidence: {
      storedEnergy: nonNegative(snapshot.storedEnergy),
      firmProduction: nonNegative(snapshot.firmProduction),
      demand: nonNegative(snapshot.demand),
      sustainable: security.sustainable,
      stockCoverageTicks: security.stockCoverageTicks ?? 'n/a',
      deficitCoverageTicks: security.deficitCoverageTicks ?? 'n/a',
    },
  }
}

/**
 * Converts a known station slug into a structural orbital-logistics capability
 * snapshot using the canonical station service profile and docking topology.
 * Unknown station slugs fail closed because a generic profile is not evidence
 * that a physical docking topology exists.
 *
 * Shipyards are deliberately excluded here until their authoritative runtime
 * binding is available to this projection. Unknown capability must not be
 * converted into `false` and then silently penalize the score.
 */
export function buildOrbitalStationCapabilitySnapshot(input: {
  slug: string
}): OrbitalStationCapabilitySnapshot | null {
  if (!Object.prototype.hasOwnProperty.call(STATION_SERVICE_PROFILES, input.slug)) return null

  const topology = getStationDockingTopology(input.slug)
  if (!topology) return null

  const profile = getStationServiceProfile(input.slug)
  return {
    slug: input.slug,
    cargoPortCount: topology.ports.filter(port => port.cargoEnabled).length,
    heavyPortCount: topology.ports.filter(port => port.portClass === 'heavy').length,
    servicePortCount: topology.ports.filter(port => port.role === 'service-maintenance').length,
    hasDepot: profile.depotMode !== 'none',
    onwardTransfer: profile.onwardTransfer,
  }
}

export function deriveOrbitalLogisticsSignal(
  stations: readonly OrbitalStationCapabilitySnapshot[],
  sourceRef: string,
): DerivedWorldDevelopmentSignal | null {
  if (stations.length === 0) return null

  const cargoPorts = stations.reduce((sum, station) => sum + station.cargoPortCount, 0)
  const heavyPorts = stations.reduce((sum, station) => sum + station.heavyPortCount, 0)
  const servicePorts = stations.reduce((sum, station) => sum + station.servicePortCount, 0)
  const depotCount = stations.filter(station => station.hasDepot).length
  const onwardCount = stations.filter(station => station.onwardTransfer).length

  const nodeDepth = clamp01(stations.length / 3)
  const cargoDepth = clamp01(cargoPorts / 6)
  const heavyDepth = heavyPorts > 0 ? 1 : 0
  const serviceDepth = servicePorts > 0 ? 1 : 0
  const depotDepth = clamp01(depotCount / stations.length)
  const onwardDepth = clamp01(onwardCount / stations.length)

  const value = clamp01(
    0.15 * nodeDepth
    + 0.30 * cargoDepth
    + 0.20 * heavyDepth
    + 0.15 * serviceDepth
    + 0.10 * depotDepth
    + 0.10 * onwardDepth,
  )

  return {
    signal: {
      driverId: 'orbital_logistics',
      value,
      sourceRef,
    },
    explanation: 'Structural orbital-logistics capacity derived from live known stations plus canonical docking/service capabilities.',
    evidence: {
      stationCount: stations.length,
      cargoPorts,
      heavyPorts,
      servicePorts,
      depotCount,
      onwardTransferStations: onwardCount,
    },
  }
}
