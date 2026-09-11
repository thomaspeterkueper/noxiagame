// lib/game/moonSurfaceLogistics.ts
// noχ¹ᐃ-owned gameplay policy for lunar surface logistics.
//
// Engineering owns physical vehicle limits and capacities. Core owns inventories,
// cargo and transport jobs. This module only defines how the Moon domain interprets
// terrain-derived route metrics and which surface logistics roles must exist.

export type MoonSurfaceRouteClass = 'offroad' | 'prepared-track' | 'hardened-road'
export type MoonSurfaceVehicleRole = 'cargo-rover' | 'heavy-hauler'

export type MoonSurfaceLogisticsNodeRole =
  | 'mine-buffer'
  | 'processing-buffer'
  | 'logistics-hub'
  | 'shuttle-port-storage'

export interface MoonSurfaceChainNode {
  role: MoonSurfaceLogisticsNodeRole
  label: string
  purpose: string
}

export const SHACKLETON_SURFACE_LOGISTICS_CHAIN: readonly MoonSurfaceChainNode[] = [
  {
    role: 'mine-buffer',
    label: 'Minenpuffer',
    purpose: 'Entkoppelt kontinuierliche Förderung von diskreten Fahrzeugabholungen.',
  },
  {
    role: 'processing-buffer',
    label: 'Verarbeitungs-/Zwischenpuffer',
    purpose: 'Optionaler Umschlag vor oder nach Schmelze/Fabrik, ohne das Core-Inventarmodell zu duplizieren.',
  },
  {
    role: 'logistics-hub',
    label: 'Warenhaus / Logistik-Hub',
    purpose: 'Bündelt lokale Warenströme, Fahrzeugzuweisung und Weiterverteilung in der Shackleton-Siedlung.',
  },
  {
    role: 'shuttle-port-storage',
    label: 'Shuttle-Port-Lager',
    purpose: 'Übergabepunkt vom lunaren Oberflächentransport an das separate Surface-to-Orbit-Shuttle-System.',
  },
] as const

export interface MoonTerrainProfileSample {
  /** Cumulative distance along the candidate route. Must be monotonically increasing. */
  distanceM: number
  /** Terrain elevation in the verified lunar frame, typically sampled from LOLA-derived terrain. */
  elevationM: number
}

export interface MoonRouteMetrics {
  distanceM: number
  ascentM: number
  descentM: number
  meanAbsSlopeDeg: number
  maxAbsSlopeDeg: number
}

/**
 * Derive renderer-independent route metrics from a sampled lunar height profile.
 * The caller owns sampling density and data provenance; unresolved terrain must not
 * be silently synthesized before calling this function.
 */
export function deriveMoonRouteMetrics(samples: readonly MoonTerrainProfileSample[]): MoonRouteMetrics {
  if (samples.length < 2) throw new Error('Moon route metrics require at least two terrain samples')

  let ascentM = 0
  let descentM = 0
  let weightedAbsSlopeDeg = 0
  let maxAbsSlopeDeg = 0
  let totalDistanceM = 0

  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1]
    const current = samples[index]
    if (!Number.isFinite(previous.distanceM) || !Number.isFinite(previous.elevationM)
      || !Number.isFinite(current.distanceM) || !Number.isFinite(current.elevationM)) {
      throw new Error('Moon route profile contains non-finite values')
    }

    const runM = current.distanceM - previous.distanceM
    if (!(runM > 0)) throw new Error('Moon route profile distances must be strictly increasing')

    const riseM = current.elevationM - previous.elevationM
    if (riseM >= 0) ascentM += riseM
    else descentM += -riseM

    const absSlopeDeg = Math.abs(Math.atan2(riseM, runM) * 180 / Math.PI)
    weightedAbsSlopeDeg += absSlopeDeg * runM
    maxAbsSlopeDeg = Math.max(maxAbsSlopeDeg, absSlopeDeg)
    totalDistanceM += runM
  }

  return {
    distanceM: totalDistanceM,
    ascentM,
    descentM,
    meanAbsSlopeDeg: totalDistanceM > 0 ? weightedAbsSlopeDeg / totalDistanceM : 0,
    maxAbsSlopeDeg,
  }
}

export interface MoonVehicleMobilityEnvelope {
  /** Role only; mass, payload and engineering identity remain outside this module. */
  role: MoonSurfaceVehicleRole
  /** Safe longitudinal slope for the current vehicle/load state, supplied by Engineering/Core mapping. */
  safeLongitudinalSlopeDeg: number
}

export interface MoonRouteAssessmentInput {
  routeClass: MoonSurfaceRouteClass
  metrics: MoonRouteMetrics
  vehicle: MoonVehicleMobilityEnvelope
  /** 0 = smooth for this route class; 1 = worst still classified as this route class. */
  roughness01?: number
}

export interface MoonRouteAssessment {
  passable: boolean
  reason: 'ok' | 'slope-limit'
  /** Relative to the same vehicle on a smooth hardened road at negligible grade. */
  speedMultiplier: number
  /** Relative traction/rolling/terrain energy burden; not an absolute kWh value. */
  energyMultiplier: number
  allowedSlopeDeg: number
}

interface RouteClassPolicy {
  speedFactor: number
  energyFactor: number
  usableSlopeFraction: number
  roughnessSpeedPenalty: number
  roughnessEnergyPenalty: number
}

/**
 * Provisional gameplay coefficients, deliberately dimensionless. They express the
 * ordering between route classes without pretending to be engineering vehicle data.
 * Replace/tune them when KUEPER Engineering returns validated mobility envelopes.
 */
export const MOON_ROUTE_CLASS_POLICY: Readonly<Record<MoonSurfaceRouteClass, RouteClassPolicy>> = {
  offroad: {
    speedFactor: 0.45,
    energyFactor: 1.65,
    usableSlopeFraction: 0.70,
    roughnessSpeedPenalty: 0.35,
    roughnessEnergyPenalty: 0.45,
  },
  'prepared-track': {
    speedFactor: 0.72,
    energyFactor: 1.25,
    usableSlopeFraction: 0.85,
    roughnessSpeedPenalty: 0.22,
    roughnessEnergyPenalty: 0.25,
  },
  'hardened-road': {
    speedFactor: 1,
    energyFactor: 1,
    usableSlopeFraction: 1,
    roughnessSpeedPenalty: 0.12,
    roughnessEnergyPenalty: 0.12,
  },
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value))
}

/**
 * Assess a lunar candidate route using LOLA/terrain-derived slope metrics plus a
 * vehicle mobility envelope supplied by the Engineering/Core boundary.
 *
 * This is intentionally relative: no vehicle mass, payload, kWh/km or speed is
 * invented here. The result can weight pathfinding and ETA/energy estimates while
 * remaining compatible with later engineering data.
 */
export function assessMoonSurfaceRoute(input: MoonRouteAssessmentInput): MoonRouteAssessment {
  const { routeClass, metrics, vehicle } = input
  if (!Number.isFinite(vehicle.safeLongitudinalSlopeDeg) || vehicle.safeLongitudinalSlopeDeg <= 0) {
    throw new Error('Moon vehicle safeLongitudinalSlopeDeg must be positive')
  }
  if (!Number.isFinite(metrics.meanAbsSlopeDeg) || !Number.isFinite(metrics.maxAbsSlopeDeg)
    || metrics.meanAbsSlopeDeg < 0 || metrics.maxAbsSlopeDeg < 0) {
    throw new Error('Moon route slope metrics must be finite and non-negative')
  }

  const policy = MOON_ROUTE_CLASS_POLICY[routeClass]
  const roughness = clamp01(input.roughness01 ?? 0)
  const allowedSlopeDeg = vehicle.safeLongitudinalSlopeDeg * policy.usableSlopeFraction
  const passable = metrics.maxAbsSlopeDeg <= allowedSlopeDeg
  const slopeRatio = allowedSlopeDeg > 0 ? Math.min(1.5, metrics.meanAbsSlopeDeg / allowedSlopeDeg) : 1.5

  const speedMultiplier = Math.max(
    0.08,
    policy.speedFactor
      * (1 - roughness * policy.roughnessSpeedPenalty)
      * (1 - Math.min(0.7, slopeRatio * 0.5)),
  )
  const energyMultiplier = policy.energyFactor
    * (1 + roughness * policy.roughnessEnergyPenalty)
    * (1 + slopeRatio * 0.8)

  return {
    passable,
    reason: passable ? 'ok' : 'slope-limit',
    speedMultiplier,
    energyMultiplier,
    allowedSlopeDeg,
  }
}

export const MOON_SURFACE_VEHICLE_ROLE_REQUIREMENTS: Readonly<Record<MoonSurfaceVehicleRole, readonly string[]>> = {
  'cargo-rover': [
    'flexible lokale Frachtverteilung zwischen Mine, Verarbeitung, Lager und Hub',
    'autonomer wiederholbarer Betrieb auf wechselnden Offroad-/Trassenabschnitten',
    'schnelles Be- und Entladen an standardisierten Oberflächenknoten',
    'Bergungs- und Fail-safe-Verhalten bei Kommunikations- oder Mobilitätsausfall',
  ],
  'heavy-hauler': [
    'hohe Nutzlast auf wiederkehrenden industriellen Korridoren',
    'priorisierte Nutzung vorbereiteter oder befestigter Schwerlastrouten',
    'Durchsatzoptimierung statt maximaler Routenflexibilität',
    'Wartungs-, Depot- und Bergungskonzept für hohe Wiederhollast',
  ],
}
