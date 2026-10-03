import { EARTH_LANDMARKS, type EarthLandmark } from './earthLandmarks'

export type EarthLandmarkMappingPrecision = 'real_location' | 'approximate' | 'fictionalized'
export type EarthLandmarkMapPoint = {
  lat: number
  lon: number
  precision: EarthLandmarkMappingPrecision
}

/**
 * Presentation coordinates for known Earth landmarks.
 *
 * Canonical landmark identity remains the locator/address in earthLandmarks.ts.
 * These coordinates exist only to place markers on the shared Earth surface.
 * Precision is explicit so an approximate literary/city anchor can never be
 * mistaken for an observed exact point.
 */
export const EARTH_LANDMARK_MAP_POINTS: Readonly<Record<string, EarthLandmarkMapPoint>> = {
  'earth-de-menden-hexenteich': { lat: 51.4372958, lon: 7.8219999, precision: 'real_location' },
  'earth-de-menden-gesamtschule': { lat: 51.42996, lon: 7.79372, precision: 'real_location' },
  'earth-de-sundern-ssf-hq': { lat: 51.328, lon: 8.004, precision: 'real_location' },
  'earth-de-darmstadt-esoc': { lat: 49.8728, lon: 8.6227, precision: 'real_location' },
  'earth-de-darmstadt-eumetsat': { lat: 49.8627, lon: 8.6276, precision: 'real_location' },
  'earth-de-cologne-eac': { lat: 50.852, lon: 7.126, precision: 'real_location' },
  'earth-de-oberpfaffenhofen-dlr': { lat: 48.083, lon: 11.283, precision: 'real_location' },
  'earth-in-dwarka': { lat: 22.244, lon: 68.968, precision: 'approximate' },
  'earth-gr-phaistos': { lat: 35.051, lon: 24.814, precision: 'real_location' },
  'earth-eg-alexandria': { lat: 31.2001, lon: 29.9187, precision: 'approximate' },
}

export function earthLandmarksInBounds(bounds: { south:number; west:number; north:number; east:number }) {
  return EARTH_LANDMARKS.flatMap(landmark => {
    const point = EARTH_LANDMARK_MAP_POINTS[landmark.id]
    if (!point) return []
    if (point.lat < bounds.south || point.lat > bounds.north || point.lon < bounds.west || point.lon > bounds.east) return []
    return [{ landmark, point }]
  })
}

export function earthLandmarkProjectSummary(landmark: EarthLandmark) {
  return landmark.sourceProjects.map(project => ({
    project: project.project,
    relation: project.relation,
    note: project.note ?? null,
  }))
}
