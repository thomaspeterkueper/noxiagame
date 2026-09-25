import type { ImportedEarthFeature } from './earthFeatureSource'
import type { GeoPoint } from './earthSpatial'
import { EARTH_SAUERLAND_REGION } from './regions'
import type { TerrainSuitabilityCell } from './siteSuitability'
import { SELMECKE_REFERENCE_SITE } from './earthReferenceSites'

type MetricPoint = { eastM: number; northM: number }

export type CatapultProfileSample = {
  distanceM: number
  elevationM: number
  segmentGradePercent: number | null
}

export type CatapultCorridorCandidate = {
  id: string
  rank: number
  score: number
  start: GeoPoint
  end: GeoPoint
  azimuthDeg: number
  analysedLengthM: number
  elevationGainM: number
  averageGradePercent: number
  maxSegmentGradePercent: number
  gradeVariationPercent: number
  monotonicClimbShare: number
  sundernHubDistanceM: number
  selmeckeDistanceM: number
  departureConflictDistanceM: number | null
  departureConflictType: string | null
  sourceResolutionM: number
  profile: CatapultProfileSample[]
  planningStatus: 'terrain-screening-only'
  orbitalAzimuthStatus: 'mission-profile-unresolved'
  geologyStatus: 'unresolved'
  notes: string[]
}

export type CatapultCorridorScreening = {
  hub: {
    role: 'Sundern regional transport and operations hub'
    point: GeoPoint
    precision: 'regional-anchor-only'
  }
  parameters: {
    targetLengthM: number
    desiredAverageGradePercent: [number, number]
    departureScreeningLengthM: number
    departureHalfWidthM: number
    testedAzimuthStepDeg: number
  }
  candidates: CatapultCorridorCandidate[]
  status: 'planning-only-not-canonical'
}

const HUB = EARTH_SAUERLAND_REGION.origin
const TARGET_LENGTH_M = 2_400
const DESIRED_GRADE: [number, number] = [4, 12]
const DEPARTURE_LENGTH_M = 4_000
const DEPARTURE_HALF_WIDTH_M = 650
const AZIMUTH_STEP_DEG = 22.5

function toMetric(origin: GeoPoint, point: GeoPoint): MetricPoint {
  return {
    eastM: (point.lon - origin.lon) * 111_320 * Math.cos(((origin.lat + point.lat) * Math.PI) / 360),
    northM: (point.lat - origin.lat) * 111_320,
  }
}

function toGeo(origin: GeoPoint, point: MetricPoint): GeoPoint {
  return {
    lat: origin.lat + point.northM / 111_320,
    lon: origin.lon + point.eastM / (111_320 * Math.cos(origin.lat * Math.PI / 180)),
  }
}

function distanceM(a: GeoPoint, b: GeoPoint) {
  const p = toMetric(a, b)
  return Math.hypot(p.eastM, p.northM)
}

function featurePoints(feature: ImportedEarthFeature): GeoPoint[] {
  return feature.geometry.kind === 'point' ? [feature.geometry.coordinates] : feature.geometry.coordinates
}

function nearestCell(point: MetricPoint, cells: Array<TerrainSuitabilityCell & MetricPoint>, limitM: number) {
  let nearest: TerrainSuitabilityCell | null = null
  let best = Infinity
  for (const cell of cells) {
    const distance = Math.hypot(cell.eastM - point.eastM, cell.northM - point.northM)
    if (distance < best) { best = distance; nearest = cell }
  }
  return best <= limitM ? nearest : null
}

function departureConflict(
  end: MetricPoint,
  ux: number,
  uy: number,
  features: ImportedEarthFeature[],
) {
  let distance = Infinity
  let type: string | null = null
  for (const feature of features) {
    if (!['building', 'settlement', 'public', 'industrial'].includes(feature.featureType)) continue
    for (const point of featurePoints(feature)) {
      const metric = toMetric(HUB, point)
      const dx = metric.eastM - end.eastM
      const dy = metric.northM - end.northM
      const along = dx * ux + dy * uy
      const lateral = Math.abs(dx * uy - dy * ux)
      if (along < 0 || along > DEPARTURE_LENGTH_M || lateral > DEPARTURE_HALF_WIDTH_M) continue
      const corridorDistance = Math.hypot(along, lateral)
      if (corridorDistance < distance) { distance = corridorDistance; type = feature.featureType }
    }
  }
  return { distanceM: Number.isFinite(distance) ? Math.round(distance) : null, type }
}

function scoreCandidate(input: {
  averageGrade: number
  maxSegmentGrade: number
  variation: number
  monotonicShare: number
  departureConflictDistanceM: number | null
  sundernDistanceM: number
}) {
  let score = 100
  if (input.averageGrade < DESIRED_GRADE[0]) score -= (DESIRED_GRADE[0] - input.averageGrade) * 8
  if (input.averageGrade > DESIRED_GRADE[1]) score -= (input.averageGrade - DESIRED_GRADE[1]) * 9
  score -= Math.max(0, input.maxSegmentGrade - 18) * 4
  score -= input.variation * 2.5
  score -= (1 - input.monotonicShare) * 45
  if (input.departureConflictDistanceM != null) {
    score -= input.departureConflictDistanceM < 1_000 ? 55 : input.departureConflictDistanceM < 2_000 ? 30 : 12
  }
  score -= Math.max(0, input.sundernDistanceM - 12_000) / 1_000 * 2
  return Math.round(Math.max(0, Math.min(100, score)))
}

/**
 * Coarse, terrain-led search for a rising electromagnetic-launch alignment.
 * It does not approve a vehicle, orbital azimuth, safety corridor, geology or site.
 */
export function analyseCatapultCorridors(
  terrainCells: TerrainSuitabilityCell[],
  features: ImportedEarthFeature[],
  sourceResolutionM: number,
  limit = 5,
): CatapultCorridorScreening {
  const metricCells = terrainCells.map(cell => ({ ...cell, ...toMetric(HUB, cell) }))
  const sampleStepM = Math.max(250, sourceResolutionM)
  const sampleDistances = Array.from({ length: Math.floor(TARGET_LENGTH_M / sampleStepM) + 1 }, (_, index) => index * sampleStepM)
  if (sampleDistances.at(-1)! < TARGET_LENGTH_M * .85) sampleDistances.push(TARGET_LENGTH_M)
  const raw: Omit<CatapultCorridorCandidate, 'rank'>[] = []

  for (const startCell of metricCells) {
    const start = { eastM: startCell.eastM, northM: startCell.northM }
    for (let azimuthDeg = 0; azimuthDeg < 360; azimuthDeg += AZIMUTH_STEP_DEG) {
      const radians = azimuthDeg * Math.PI / 180
      const ux = Math.sin(radians)
      const uy = Math.cos(radians)
      const sampled = sampleDistances.map(distance => ({
        distance,
        cell: nearestCell(
          { eastM: start.eastM + ux * distance, northM: start.northM + uy * distance },
          metricCells,
          Math.max(sourceResolutionM * .8, 450),
        ),
      })).filter(item => item.cell != null) as Array<{ distance: number; cell: TerrainSuitabilityCell }>
      if (sampled.length < Math.max(4, sampleDistances.length * .75)) continue

      const grades: number[] = []
      const profile: CatapultProfileSample[] = sampled.map((item, index) => {
        if (!index) return { distanceM: Math.round(item.distance), elevationM: item.cell.elevationM, segmentGradePercent: null }
        const previous = sampled[index - 1]
        const distance = item.distance - previous.distance
        const grade = distance > 0 ? (item.cell.elevationM - previous.cell.elevationM) / distance * 100 : 0
        grades.push(grade)
        return { distanceM: Math.round(item.distance), elevationM: item.cell.elevationM, segmentGradePercent: Math.round(grade * 10) / 10 }
      })
      const analysedLengthM = profile.at(-1)!.distanceM - profile[0].distanceM
      if (analysedLengthM < TARGET_LENGTH_M * .75) continue
      const elevationGainM = profile.at(-1)!.elevationM - profile[0].elevationM
      if (elevationGainM <= 0) continue
      const averageGrade = elevationGainM / analysedLengthM * 100
      const maxSegmentGrade = Math.max(...grades.map(Math.abs))
      const mean = grades.reduce((sum, grade) => sum + grade, 0) / grades.length
      const variation = Math.sqrt(grades.reduce((sum, grade) => sum + (grade - mean) ** 2, 0) / grades.length)
      const monotonicShare = grades.filter(grade => grade >= -1).length / grades.length
      const endMetric = { eastM: start.eastM + ux * analysedLengthM, northM: start.northM + uy * analysedLengthM }
      const startGeo = toGeo(HUB, start)
      const endGeo = toGeo(HUB, endMetric)
      const conflict = departureConflict(endMetric, ux, uy, features)
      const sundernDistanceM = distanceM(HUB, startGeo)
      const score = scoreCandidate({ averageGrade, maxSegmentGrade, variation, monotonicShare, departureConflictDistanceM: conflict.distanceM, sundernDistanceM })
      raw.push({
        id: `catapult-${startGeo.lat.toFixed(5)}-${startGeo.lon.toFixed(5)}-${Math.round(azimuthDeg)}`,
        score,
        start: startGeo,
        end: endGeo,
        azimuthDeg: Math.round(azimuthDeg * 10) / 10,
        analysedLengthM: Math.round(analysedLengthM),
        elevationGainM: Math.round(elevationGainM * 10) / 10,
        averageGradePercent: Math.round(averageGrade * 10) / 10,
        maxSegmentGradePercent: Math.round(maxSegmentGrade * 10) / 10,
        gradeVariationPercent: Math.round(variation * 10) / 10,
        monotonicClimbShare: Math.round(monotonicShare * 100) / 100,
        sundernHubDistanceM: Math.round(sundernDistanceM),
        selmeckeDistanceM: Math.round(distanceM(SELMECKE_REFERENCE_SITE.point, startGeo)),
        departureConflictDistanceM: conflict.distanceM,
        departureConflictType: conflict.type,
        sourceResolutionM,
        profile,
        planningStatus: 'terrain-screening-only',
        orbitalAzimuthStatus: 'mission-profile-unresolved',
        geologyStatus: 'unresolved',
        notes: [
          'gerichtete Hangvorprüfung; keine Katapult- oder Flugbetriebsfreigabe',
          'Sundern-Anbindung basiert auf einem regionalen Kartenanker, nicht auf einer festgelegten Bahnhofstrasse',
          'Orbitalazimut, Abbruchräume, Lärm, Geologie und Schutzgebiete bleiben separat zu prüfen',
        ],
      })
    }
  }

  const selected: Omit<CatapultCorridorCandidate, 'rank'>[] = []
  for (const candidate of raw.sort((a, b) => b.score - a.score)) {
    const duplicate = selected.some(existing => distanceM(existing.start, candidate.start) < 1_000)
    if (duplicate) continue
    selected.push(candidate)
    if (selected.length >= limit) break
  }

  return {
    hub: { role: 'Sundern regional transport and operations hub', point: { ...HUB }, precision: 'regional-anchor-only' },
    parameters: { targetLengthM: TARGET_LENGTH_M, desiredAverageGradePercent: DESIRED_GRADE, departureScreeningLengthM: DEPARTURE_LENGTH_M, departureHalfWidthM: DEPARTURE_HALF_WIDTH_M, testedAzimuthStepDeg: AZIMUTH_STEP_DEG },
    candidates: selected.map((candidate, index) => ({ ...candidate, rank: index + 1 })),
    status: 'planning-only-not-canonical',
  }
}
