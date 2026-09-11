// lib/game/earthSurfaceLogistics.ts
// noχ¹ᐃ-owned gameplay policy for Earth surface logistics.
//
// Core owns inventories, cargo, stateful vehicles and transport jobs. Earth owns
// how existing OSM/terrain observations are interpreted for road preference,
// offroad fallback and relative traversal cost. No persistence lives here.

export type EarthSurfaceVehicleRole = 'cargo-rover' | 'heavy-hauler'

export type EarthSurfaceRouteClass =
  | 'paved-road'
  | 'service-road'
  | 'track'
  | 'offroad'
  | 'unresolved'

export type EarthRoadSuitability = 'preferred' | 'allowed' | 'blocked' | 'unresolved'

export type EarthOffroadGroundClass =
  | 'open'
  | 'vegetated'
  | 'soft-ground'
  | 'built'
  | 'water'
  | 'protected'
  | 'unresolved'

export interface EarthRoadClassification {
  routeClass: Exclude<EarthSurfaceRouteClass, 'offroad'>
  suitability: EarthRoadSuitability
  reason:
    | 'road-supported'
    | 'vehicle-restricted'
    | 'access-restricted'
    | 'pedestrian-only'
    | 'construction'
    | 'missing-highway-class'
  highway: string | null
  surface: string | null
}

export interface EarthVehicleMobilityEnvelope {
  role: EarthSurfaceVehicleRole
  /**
   * Engineering/Core-provided safe longitudinal slope for the current vehicle/load.
   * Earth never invents a physical vehicle limit; it applies route-class policy.
   */
  safeLongitudinalSlopeDeg: number
}

export interface EarthOffroadTerrainInput {
  slopeDeg: number | null
  landuse?: string | null
  natural?: string | null
  building?: string | null
  boundary?: string | null
  leisure?: string | null
  protectedArea?: boolean
}

export interface EarthSurfaceRouteAssessment {
  routeClass: EarthSurfaceRouteClass
  passable: boolean
  reason:
    | 'ok'
    | 'slope-limit'
    | 'ground-blocked'
    | 'access-restricted'
    | 'vehicle-restricted'
    | 'unresolved'
  suitability: EarthRoadSuitability
  /** Relative to the same vehicle on a supported paved road at negligible grade. */
  speedMultiplier: number
  /** Relative traction/rolling/terrain burden; not an absolute kWh value. */
  energyMultiplier: number
  /** Relative maintenance/wear burden; not an engineering lifetime prediction. */
  wearMultiplier: number
  allowedSlopeDeg: number | null
  groundClass?: EarthOffroadGroundClass
}

interface RouteClassPolicy {
  speedFactor: number
  energyFactor: number
  wearFactor: number
  usableSlopeFraction: number
}

/**
 * Provisional Earth gameplay coefficients. They define ordering and penalties only;
 * they do not claim absolute vehicle speed, energy use or component lifetime.
 */
export const EARTH_ROUTE_CLASS_POLICY: Readonly<Record<Exclude<EarthSurfaceRouteClass, 'unresolved'>, RouteClassPolicy>> = {
  'paved-road': { speedFactor: 1, energyFactor: 1, wearFactor: 1, usableSlopeFraction: 1 },
  'service-road': { speedFactor: 0.82, energyFactor: 1.12, wearFactor: 1.15, usableSlopeFraction: 0.92 },
  track: { speedFactor: 0.62, energyFactor: 1.35, wearFactor: 1.55, usableSlopeFraction: 0.78 },
  offroad: { speedFactor: 0.42, energyFactor: 1.75, wearFactor: 2.2, usableSlopeFraction: 0.62 },
}

/** Maximum short unmapped connector from a facility footprint to observed roads. */
export const EARTH_LAST_MILE_FALLBACK_M: Readonly<Record<EarthSurfaceVehicleRole, number>> = {
  'cargo-rover': 75,
  'heavy-hauler': 50,
}

const PAVED_SURFACES = new Set([
  'asphalt', 'concrete', 'concrete:lanes', 'concrete:plates', 'paving_stones', 'sett',
])

const UNPAVED_SURFACES = new Set([
  'unpaved', 'gravel', 'fine_gravel', 'compacted', 'ground', 'dirt', 'earth', 'sand', 'grass',
])

const NORMAL_ROADS = new Set([
  'motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link',
  'secondary', 'secondary_link', 'tertiary', 'tertiary_link', 'residential',
  'unclassified', 'living_street',
])

const PEDESTRIAN_ONLY = new Set([
  'footway', 'path', 'pedestrian', 'cycleway', 'bridleway', 'steps', 'corridor',
])

function normalizedTag(tags: Record<string, string | undefined>, key: string) {
  return tags[key]?.trim().toLowerCase() || null
}

function explicitMotorVehicleBlock(tags: Record<string, string | undefined>) {
  const motorVehicle = normalizedTag(tags, 'motor_vehicle')
  const vehicle = normalizedTag(tags, 'vehicle')
  return motorVehicle === 'no' || motorVehicle === 'private' || vehicle === 'no'
}

/**
 * Interpret the OSM tags already present in the Earth region payload. This does not
 * create a second road geometry; callers keep using the existing OSM feature layer.
 */
export function classifyEarthRoad(
  tags: Record<string, string | undefined>,
  vehicleRole: EarthSurfaceVehicleRole,
): EarthRoadClassification {
  const highway = normalizedTag(tags, 'highway')
  const surface = normalizedTag(tags, 'surface')
  const access = normalizedTag(tags, 'access')

  if (access === 'no' || access === 'private') {
    return { routeClass: 'unresolved', suitability: 'blocked', reason: 'access-restricted', highway, surface }
  }
  if (explicitMotorVehicleBlock(tags)) {
    return { routeClass: 'unresolved', suitability: 'blocked', reason: 'vehicle-restricted', highway, surface }
  }
  if (!highway) {
    return { routeClass: 'unresolved', suitability: 'unresolved', reason: 'missing-highway-class', highway, surface }
  }
  if (PEDESTRIAN_ONLY.has(highway)) {
    return { routeClass: 'unresolved', suitability: 'blocked', reason: 'pedestrian-only', highway, surface }
  }
  if (highway === 'construction' || highway === 'proposed') {
    return { routeClass: 'unresolved', suitability: 'blocked', reason: 'construction', highway, surface }
  }

  if (highway === 'track') {
    return { routeClass: 'track', suitability: 'allowed', reason: 'road-supported', highway, surface }
  }

  if (highway === 'service') {
    const routeClass: EarthRoadClassification['routeClass'] = UNPAVED_SURFACES.has(surface ?? '') ? 'track' : 'service-road'
    return {
      routeClass,
      suitability: vehicleRole === 'cargo-rover' ? 'preferred' : 'allowed',
      reason: 'road-supported', highway, surface,
    }
  }

  if (NORMAL_ROADS.has(highway)) {
    const routeClass: EarthRoadClassification['routeClass'] = UNPAVED_SURFACES.has(surface ?? '') ? 'track' : 'paved-road'
    return {
      routeClass,
      suitability: routeClass === 'paved-road' ? 'preferred' : 'allowed',
      reason: 'road-supported', highway, surface,
    }
  }

  // Surface alone is not enough to invent routability for an unknown highway class.
  if (surface && PAVED_SURFACES.has(surface)) {
    return { routeClass: 'unresolved', suitability: 'unresolved', reason: 'missing-highway-class', highway, surface }
  }
  return { routeClass: 'unresolved', suitability: 'unresolved', reason: 'missing-highway-class', highway, surface }
}

export function classifyEarthOffroadGround(input: EarthOffroadTerrainInput): EarthOffroadGroundClass {
  const landuse = input.landuse?.toLowerCase() ?? null
  const natural = input.natural?.toLowerCase() ?? null
  const boundary = input.boundary?.toLowerCase() ?? null
  const leisure = input.leisure?.toLowerCase() ?? null

  if (input.protectedArea || boundary === 'protected_area' || leisure === 'nature_reserve') return 'protected'
  if (input.building && input.building !== 'no') return 'built'
  if (natural === 'water' || landuse === 'basin' || landuse === 'reservoir') return 'water'
  if (natural === 'wetland' || natural === 'mud' || natural === 'sand') return 'soft-ground'
  if (['residential', 'commercial', 'industrial', 'retail', 'construction', 'cemetery'].includes(landuse ?? '')) return 'built'
  if (['forest', 'orchard', 'vineyard'].includes(landuse ?? '') || ['wood', 'scrub'].includes(natural ?? '')) return 'vegetated'
  if (['farmland', 'farmyard', 'meadow', 'grass', 'greenfield', 'brownfield'].includes(landuse ?? '')
    || ['grassland', 'heath', 'bare_rock', 'scree'].includes(natural ?? '')) return 'open'

  if (!landuse && !natural && !input.building && !boundary && !leisure) return 'unresolved'
  return 'open'
}

function groundCostFactor(ground: EarthOffroadGroundClass) {
  switch (ground) {
    case 'open': return { speed: 1, energy: 1, wear: 1 }
    case 'vegetated': return { speed: 0.78, energy: 1.18, wear: 1.22 }
    case 'soft-ground': return { speed: 0.58, energy: 1.45, wear: 1.45 }
    default: return { speed: 1, energy: 1, wear: 1 }
  }
}

/**
 * Assess offroad fallback using observed Earth slope/landuse plus an Engineering/Core
 * vehicle slope envelope. Water, built-up and protected ground are never silently
 * treated as generic cross-country terrain.
 */
export function assessEarthOffroad(
  terrain: EarthOffroadTerrainInput,
  vehicle: EarthVehicleMobilityEnvelope,
): EarthSurfaceRouteAssessment {
  if (!Number.isFinite(vehicle.safeLongitudinalSlopeDeg) || vehicle.safeLongitudinalSlopeDeg <= 0) {
    throw new Error('Earth vehicle safeLongitudinalSlopeDeg must be positive')
  }

  const groundClass = classifyEarthOffroadGround(terrain)
  const allowedSlopeDeg = vehicle.safeLongitudinalSlopeDeg * EARTH_ROUTE_CLASS_POLICY.offroad.usableSlopeFraction
  if (groundClass === 'water' || groundClass === 'built' || groundClass === 'protected') {
    return {
      routeClass: 'offroad', passable: false, reason: 'ground-blocked', suitability: 'blocked',
      speedMultiplier: 0, energyMultiplier: Infinity, wearMultiplier: Infinity,
      allowedSlopeDeg, groundClass,
    }
  }
  if (terrain.slopeDeg == null || !Number.isFinite(terrain.slopeDeg) || terrain.slopeDeg < 0 || groundClass === 'unresolved') {
    return {
      routeClass: 'unresolved', passable: false, reason: 'unresolved', suitability: 'unresolved',
      speedMultiplier: 0, energyMultiplier: Infinity, wearMultiplier: Infinity,
      allowedSlopeDeg: null, groundClass,
    }
  }
  if (terrain.slopeDeg > allowedSlopeDeg) {
    return {
      routeClass: 'offroad', passable: false, reason: 'slope-limit', suitability: 'blocked',
      speedMultiplier: 0, energyMultiplier: Infinity, wearMultiplier: Infinity,
      allowedSlopeDeg, groundClass,
    }
  }

  const policy = EARTH_ROUTE_CLASS_POLICY.offroad
  const slopeRatio = Math.min(1, terrain.slopeDeg / allowedSlopeDeg)
  const ground = groundCostFactor(groundClass)
  return {
    routeClass: 'offroad', passable: true, reason: 'ok', suitability: 'allowed',
    speedMultiplier: Math.max(0.08, policy.speedFactor * ground.speed * (1 - slopeRatio * 0.42)),
    energyMultiplier: policy.energyFactor * ground.energy * (1 + slopeRatio * 0.72),
    wearMultiplier: policy.wearFactor * ground.wear * (1 + slopeRatio * 0.55),
    allowedSlopeDeg, groundClass,
  }
}

/** Relative road traversal cost for route weighting and Earth UX. */
export function assessEarthRoadTraversal(
  classification: EarthRoadClassification,
  vehicle: EarthVehicleMobilityEnvelope,
  observedSlopeDeg?: number | null,
): EarthSurfaceRouteAssessment {
  if (!Number.isFinite(vehicle.safeLongitudinalSlopeDeg) || vehicle.safeLongitudinalSlopeDeg <= 0) {
    throw new Error('Earth vehicle safeLongitudinalSlopeDeg must be positive')
  }
  if (classification.suitability === 'blocked') {
    const reason = classification.reason === 'access-restricted' ? 'access-restricted' : 'vehicle-restricted'
    return { routeClass: classification.routeClass, passable: false, reason, suitability: 'blocked', speedMultiplier: 0, energyMultiplier: Infinity, wearMultiplier: Infinity, allowedSlopeDeg: null }
  }
  if (classification.routeClass === 'unresolved' || classification.suitability === 'unresolved') {
    return { routeClass: 'unresolved', passable: false, reason: 'unresolved', suitability: 'unresolved', speedMultiplier: 0, energyMultiplier: Infinity, wearMultiplier: Infinity, allowedSlopeDeg: null }
  }

  const policy = EARTH_ROUTE_CLASS_POLICY[classification.routeClass]
  const allowedSlopeDeg = vehicle.safeLongitudinalSlopeDeg * policy.usableSlopeFraction
  if (observedSlopeDeg != null) {
    if (!Number.isFinite(observedSlopeDeg) || observedSlopeDeg < 0) {
      return { routeClass: 'unresolved', passable: false, reason: 'unresolved', suitability: 'unresolved', speedMultiplier: 0, energyMultiplier: Infinity, wearMultiplier: Infinity, allowedSlopeDeg: null }
    }
    if (observedSlopeDeg > allowedSlopeDeg) {
      return { routeClass: classification.routeClass, passable: false, reason: 'slope-limit', suitability: 'blocked', speedMultiplier: 0, energyMultiplier: Infinity, wearMultiplier: Infinity, allowedSlopeDeg }
    }
  }

  const slopeRatio = observedSlopeDeg == null ? 0 : Math.min(1, observedSlopeDeg / allowedSlopeDeg)
  return {
    routeClass: classification.routeClass,
    passable: true,
    reason: 'ok',
    suitability: classification.suitability,
    speedMultiplier: Math.max(0.08, policy.speedFactor * (1 - slopeRatio * 0.32)),
    energyMultiplier: policy.energyFactor * (1 + slopeRatio * 0.5),
    wearMultiplier: policy.wearFactor * (1 + slopeRatio * 0.35),
    allowedSlopeDeg,
  }
}

export interface EarthLastMileAssessment {
  allowed: boolean
  mode: 'mapped-road' | 'short-offroad-link' | 'unresolved'
  maxFallbackDistanceM: number
}

/**
 * Permit a deliberately short offroad connector between a facility and the observed
 * OSM network. Longer missing access remains unresolved; Earth must not fabricate roads.
 */
export function assessEarthLastMileAccess(
  distanceToObservedRoadM: number | null,
  vehicleRole: EarthSurfaceVehicleRole,
  offroadPassable: boolean,
): EarthLastMileAssessment {
  const maxFallbackDistanceM = EARTH_LAST_MILE_FALLBACK_M[vehicleRole]
  if (distanceToObservedRoadM == null || !Number.isFinite(distanceToObservedRoadM) || distanceToObservedRoadM < 0) {
    return { allowed: false, mode: 'unresolved', maxFallbackDistanceM }
  }
  if (distanceToObservedRoadM === 0) return { allowed: true, mode: 'mapped-road', maxFallbackDistanceM }
  if (offroadPassable && distanceToObservedRoadM <= maxFallbackDistanceM) {
    return { allowed: true, mode: 'short-offroad-link', maxFallbackDistanceM }
  }
  return { allowed: false, mode: 'unresolved', maxFallbackDistanceM }
}

export function earthRouteClassLabel(routeClass: EarthSurfaceRouteClass) {
  switch (routeClass) {
    case 'paved-road': return 'Straße'
    case 'service-road': return 'Zufahrt / Service-Straße'
    case 'track': return 'Wirtschaftsweg / Track'
    case 'offroad': return 'Offroad'
    case 'unresolved': return 'Route ungeklärt'
  }
}
