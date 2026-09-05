import type { PlanetaryCoordinate, PlanetaryReference, WorldBody, WorldFrame } from './types'

const DEG = Math.PI / 180
const RAD = 180 / Math.PI

export const PLANETARY_REFERENCES: Record<Exclude<WorldBody, 'other'>, PlanetaryReference> = {
  earth: {
    body: 'earth',
    referenceFrame: 'WGS84',
    latitudeType: 'planetographic',
    longitudeDirection: 'positive_east',
    equatorialRadiusM: 6378137.0,
    polarRadiusM: 6356752.314245179,
    verticalDatum: 'WGS84_ELLIPSOID',
  },
  moon: {
    body: 'moon',
    referenceFrame: 'IAU_MOON_MEAN_SPHERE',
    latitudeType: 'planetocentric',
    longitudeDirection: 'positive_east',
    equatorialRadiusM: 1737400.0,
    polarRadiusM: 1737400.0,
    verticalDatum: 'MEAN_RADIUS_1737400_M',
  },
  mars: {
    body: 'mars',
    referenceFrame: 'IAU_MARS_ELLIPSOID',
    latitudeType: 'planetocentric',
    longitudeDirection: 'positive_east',
    equatorialRadiusM: 3396190.0,
    polarRadiusM: 3376200.0,
    verticalDatum: 'IAU_MARS_REFERENCE_ELLIPSOID',
  },
}

export interface CartesianPoint {
  xM: number
  yM: number
  zM: number
}

export interface EnuPoint {
  eastM: number
  northM: number
  upM: number
}

function normalizeLon(lonDeg: number) {
  const normalized = ((lonDeg + 180) % 360 + 360) % 360 - 180
  return normalized === -180 ? 180 : normalized
}

function referenceFromFrame(frame: Pick<WorldFrame, 'body' | 'referenceFrame' | 'latitudeType' | 'longitudeDirection' | 'equatorialRadiusM' | 'polarRadiusM' | 'verticalDatum'>): PlanetaryReference {
  if (frame.body !== 'other' && frame.equatorialRadiusM == null && frame.polarRadiusM == null) {
    return PLANETARY_REFERENCES[frame.body]
  }
  if (frame.equatorialRadiusM == null || frame.polarRadiusM == null) {
    throw new Error(`No planetary shape configured for body ${frame.body}`)
  }
  return {
    body: frame.body,
    referenceFrame: frame.referenceFrame ?? 'CUSTOM',
    latitudeType: frame.latitudeType ?? 'planetographic',
    longitudeDirection: frame.longitudeDirection ?? 'positive_east',
    equatorialRadiusM: frame.equatorialRadiusM,
    polarRadiusM: frame.polarRadiusM,
    verticalDatum: frame.verticalDatum ?? 'UNKNOWN',
  }
}

function planetocentricSurfaceRadius(reference: PlanetaryReference, latRad: number) {
  const a = reference.equatorialRadiusM
  const b = reference.polarRadiusM
  const cos = Math.cos(latRad)
  const sin = Math.sin(latRad)
  return 1 / Math.sqrt((cos * cos) / (a * a) + (sin * sin) / (b * b))
}

export function planetaryToCartesian(point: PlanetaryCoordinate, reference: PlanetaryReference): CartesianPoint {
  const lat = point.latDeg * DEG
  const lon = normalizeLon(point.lonDeg) * DEG
  const height = point.elevationM ?? 0
  const a = reference.equatorialRadiusM
  const b = reference.polarRadiusM

  if (reference.latitudeType === 'planetocentric') {
    const radius = planetocentricSurfaceRadius(reference, lat) + height
    const cosLat = Math.cos(lat)
    return {
      xM: radius * cosLat * Math.cos(lon),
      yM: radius * cosLat * Math.sin(lon),
      zM: radius * Math.sin(lat),
    }
  }

  const e2 = 1 - (b * b) / (a * a)
  const sinLat = Math.sin(lat)
  const cosLat = Math.cos(lat)
  const n = a / Math.sqrt(1 - e2 * sinLat * sinLat)
  return {
    xM: (n + height) * cosLat * Math.cos(lon),
    yM: (n + height) * cosLat * Math.sin(lon),
    zM: (n * (1 - e2) + height) * sinLat,
  }
}

export function cartesianToPlanetary(point: CartesianPoint, reference: PlanetaryReference): PlanetaryCoordinate {
  const { xM: x, yM: y, zM: z } = point
  const lon = Math.atan2(y, x)
  const p = Math.hypot(x, y)
  const a = reference.equatorialRadiusM
  const b = reference.polarRadiusM

  if (reference.latitudeType === 'planetocentric') {
    const lat = Math.atan2(z, p)
    const radius = Math.hypot(p, z)
    return {
      latDeg: lat * RAD,
      lonDeg: normalizeLon(lon * RAD),
      elevationM: radius - planetocentricSurfaceRadius(reference, lat),
    }
  }

  if (p < 1e-9) {
    return {
      latDeg: z >= 0 ? 90 : -90,
      lonDeg: 0,
      elevationM: Math.abs(z) - b,
    }
  }

  const e2 = 1 - (b * b) / (a * a)
  const ep2 = (a * a - b * b) / (b * b)
  const theta = Math.atan2(z * a, p * b)
  const sinTheta = Math.sin(theta)
  const cosTheta = Math.cos(theta)
  const lat = Math.atan2(
    z + ep2 * b * sinTheta ** 3,
    p - e2 * a * cosTheta ** 3,
  )
  const sinLat = Math.sin(lat)
  const n = a / Math.sqrt(1 - e2 * sinLat * sinLat)
  const elevation = p / Math.cos(lat) - n

  return {
    latDeg: lat * RAD,
    lonDeg: normalizeLon(lon * RAD),
    elevationM: elevation,
  }
}

function enuBasis(origin: PlanetaryCoordinate) {
  const lat = origin.latDeg * DEG
  const lon = normalizeLon(origin.lonDeg) * DEG
  const sinLat = Math.sin(lat)
  const cosLat = Math.cos(lat)
  const sinLon = Math.sin(lon)
  const cosLon = Math.cos(lon)
  return {
    east: [-sinLon, cosLon, 0] as const,
    north: [-sinLat * cosLon, -sinLat * sinLon, cosLat] as const,
    up: [cosLat * cosLon, cosLat * sinLon, sinLat] as const,
  }
}

function dot(vector: CartesianPoint, basis: readonly [number, number, number]) {
  return vector.xM * basis[0] + vector.yM * basis[1] + vector.zM * basis[2]
}

export function planetaryToLocalEnu(point: PlanetaryCoordinate, origin: PlanetaryCoordinate, reference: PlanetaryReference): EnuPoint {
  const pointCartesian = planetaryToCartesian(point, reference)
  const originCartesian = planetaryToCartesian(origin, reference)
  const delta = {
    xM: pointCartesian.xM - originCartesian.xM,
    yM: pointCartesian.yM - originCartesian.yM,
    zM: pointCartesian.zM - originCartesian.zM,
  }
  const basis = enuBasis(origin)
  return {
    eastM: dot(delta, basis.east),
    northM: dot(delta, basis.north),
    upM: dot(delta, basis.up),
  }
}

export function localEnuToPlanetary(point: EnuPoint, origin: PlanetaryCoordinate, reference: PlanetaryReference): PlanetaryCoordinate {
  const originCartesian = planetaryToCartesian(origin, reference)
  const basis = enuBasis(origin)
  const cartesian = {
    xM: originCartesian.xM + point.eastM * basis.east[0] + point.northM * basis.north[0] + point.upM * basis.up[0],
    yM: originCartesian.yM + point.eastM * basis.east[1] + point.northM * basis.north[1] + point.upM * basis.up[1],
    zM: originCartesian.zM + point.eastM * basis.east[2] + point.northM * basis.north[2] + point.upM * basis.up[2],
  }
  return cartesianToPlanetary(cartesian, reference)
}

export function frameOrigin(frame: WorldFrame): PlanetaryCoordinate | null {
  if (frame.originLatDeg == null || frame.originLonDeg == null || frame.originAltM == null) return null
  return { latDeg: frame.originLatDeg, lonDeg: frame.originLonDeg, elevationM: frame.originAltM }
}

export function localWorldToPlanetary(point: { xM: number; yM: number; zM: number }, frame: WorldFrame): PlanetaryCoordinate | null {
  const origin = frameOrigin(frame)
  if (!origin) return null
  return localEnuToPlanetary(
    { eastM: point.xM, northM: point.yM, upM: point.zM },
    origin,
    referenceFromFrame(frame),
  )
}

export function planetaryToLocalWorld(point: PlanetaryCoordinate, frame: WorldFrame) {
  const origin = frameOrigin(frame)
  if (!origin) return null
  const enu = planetaryToLocalEnu(point, origin, referenceFromFrame(frame))
  return { xM: enu.eastM, yM: enu.northM, zM: enu.upM }
}
