import type { ImportedEarthFeature } from './earthFeatureSource'
import type { TerrainSuitabilityCell } from './siteSuitability'
import type { GeoPoint } from './earthSpatial'

export type SpaceportCandidate = TerrainSuitabilityCell & {
  score: number
  roadDistanceM: number | null
  railDistanceM: number | null
  exclusionDistanceM: number | null
  exclusionType: string | null
  reasons: string[]
}

function distanceM(a: GeoPoint, b: GeoPoint): number {
  const latM = (b.lat - a.lat) * 111_320
  const lonM = (b.lon - a.lon) * 111_320 * Math.cos(((a.lat + b.lat) * Math.PI) / 360)
  return Math.hypot(latM, lonM)
}

function points(feature: ImportedEarthFeature): GeoPoint[] {
  return feature.geometry.kind === 'point' ? [feature.geometry.coordinates] : feature.geometry.coordinates
}

function distanceToFeature(point: GeoPoint, feature: ImportedEarthFeature): number {
  let best = Infinity
  for (const p of points(feature)) best = Math.min(best, distanceM(point, p))
  return best
}

function nearest(point: GeoPoint, features: ImportedEarthFeature[], types: string[]): { distance: number; type: string | null } {
  let distance = Infinity, type: string | null = null
  for (const feature of features) {
    if (!types.includes(feature.featureType)) continue
    const d = distanceToFeature(point, feature)
    if (d < distance) { distance = d; type = feature.featureType }
  }
  return { distance, type }
}

/**
 * Planning heuristic only. It ranks measured terrain against current real-world
 * geography; it does not establish a canonical spaceport position.
 */
export function rankSpaceportCandidates(cells: TerrainSuitabilityCell[], features: ImportedEarthFeature[]): SpaceportCandidate[] {
  const ranked = cells.map(cell => {
    const point = { lat: cell.lat, lon: cell.lon }
    const road = nearest(point, features, ['road'])
    const rail = nearest(point, features, ['rail'])
    const exclusion = nearest(point, features, ['water', 'waterway', 'building', 'settlement', 'forest'])
    const reasons: string[] = []
    let score = cell.terrainScore

    if (cell.slopePercent <= 3) { score += 8; reasons.push('geringe Hangneigung') }
    else if (cell.slopePercent > 8) { score -= 24; reasons.push('starke Hangneigung') }

    if (road.distance < 1200) { score += 9; reasons.push('gute Straßenanbindung') }
    else if (road.distance > 3000) { score -= 7; reasons.push('weit von Straßen') }

    if (rail.distance < 2500) { score += 5; reasons.push('Bahn in Reichweite') }

    if (exclusion.distance < 250) { score -= 60; reasons.push(`Konflikt: ${exclusion.type}`) }
    else if (exclusion.distance < 600) { score -= 20; reasons.push(`Nähe zu ${exclusion.type}`) }
    else { score += 5; reasons.push('Abstand zu sensibler Nutzung') }

    return {
      ...cell,
      score: Math.max(0, Math.min(100, score)),
      roadDistanceM: Number.isFinite(road.distance) ? Math.round(road.distance) : null,
      railDistanceM: Number.isFinite(rail.distance) ? Math.round(rail.distance) : null,
      exclusionDistanceM: Number.isFinite(exclusion.distance) ? Math.round(exclusion.distance) : null,
      exclusionType: exclusion.type,
      reasons,
    }
  })

  return ranked.sort((a, b) => b.score - a.score)
}
