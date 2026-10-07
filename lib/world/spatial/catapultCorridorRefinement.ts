import type { ElevationSample } from './elevationSource'
import type { GeoPoint } from './earthSpatial'
import type { CatapultCorridorCandidate } from './catapultCorridorAnalysis'

export type RefinedCatapultProfileSample = {
  distanceM: number
  elevationM: number
  segmentGradePercent: number | null
}

export type CatapultCorridorRefinement = {
  candidateId: string
  coarseRank: number
  sampleSpacingM: number
  datasetResolutionM: number
  sampledPoints: number
  analysedLengthM: number
  elevationGainM: number
  averageGradePercent: number
  maxSegmentGradePercent: number
  gradeVariationPercent: number
  monotonicClimbShare: number
  terrainVerdict: 'plausible' | 'concerning'
  profile: RefinedCatapultProfileSample[]
  status: 'fine-dem-profile-only'
}

const round1 = (value: number) => Math.round(value * 10) / 10

export function catapultProfilePoints(candidate: CatapultCorridorCandidate, sampleSpacingM = 100): GeoPoint[] {
  const segments = Math.max(1, Math.ceil(candidate.analysedLengthM / sampleSpacingM))
  return Array.from({ length: segments + 1 }, (_, index) => {
    const ratio = index / segments
    return {
      lat: candidate.start.lat + (candidate.end.lat - candidate.start.lat) * ratio,
      lon: candidate.start.lon + (candidate.end.lon - candidate.start.lon) * ratio,
    }
  })
}

export function refineCatapultCorridor(
  candidate: CatapultCorridorCandidate,
  samples: ElevationSample[],
  datasetResolutionM = 90,
): CatapultCorridorRefinement {
  if (samples.length < 2) throw new Error('Catapult refinement requires at least two elevation samples')

  const segmentLengthM = candidate.analysedLengthM / (samples.length - 1)
  const grades: number[] = []
  const profile = samples.map((sample, index) => {
    if (!index) return { distanceM: 0, elevationM: sample.elevationM, segmentGradePercent: null }
    const grade = (sample.elevationM - samples[index - 1].elevationM) / segmentLengthM * 100
    grades.push(grade)
    return {
      distanceM: Math.round(index * segmentLengthM),
      elevationM: sample.elevationM,
      segmentGradePercent: round1(grade),
    }
  })
  const elevationGainM = samples.at(-1)!.elevationM - samples[0].elevationM
  const averageGrade = elevationGainM / candidate.analysedLengthM * 100
  const maxSegmentGrade = Math.max(...grades.map(Math.abs))
  const mean = grades.reduce((sum, grade) => sum + grade, 0) / grades.length
  const variation = Math.sqrt(grades.reduce((sum, grade) => sum + (grade - mean) ** 2, 0) / grades.length)
  const monotonicShare = grades.filter(grade => grade >= -1).length / grades.length
  const plausible = averageGrade >= 4 && averageGrade <= 12 && maxSegmentGrade <= 18 && monotonicShare >= .75

  return {
    candidateId: candidate.id,
    coarseRank: candidate.rank,
    sampleSpacingM: Math.round(segmentLengthM),
    datasetResolutionM,
    sampledPoints: samples.length,
    analysedLengthM: candidate.analysedLengthM,
    elevationGainM: round1(elevationGainM),
    averageGradePercent: round1(averageGrade),
    maxSegmentGradePercent: round1(maxSegmentGrade),
    gradeVariationPercent: round1(variation),
    monotonicClimbShare: Math.round(monotonicShare * 100) / 100,
    terrainVerdict: plausible ? 'plausible' : 'concerning',
    profile,
    status: 'fine-dem-profile-only',
  }
}

export function compareRefinedCatapultCorridors(refinements: CatapultCorridorRefinement[]) {
  const score = (item: CatapultCorridorRefinement) =>
    (item.terrainVerdict === 'plausible' ? 100 : 0)
    + item.monotonicClimbShare * 25
    - item.gradeVariationPercent
    - Math.max(0, item.maxSegmentGradePercent - 18) * 3
  const ordered = [...refinements].sort((a, b) => score(b) - score(a))
  return {
    status: 'provisional-terrain-comparison' as const,
    leadingCandidateId: ordered[0]?.candidateId ?? null,
    note: 'Nur DEM-Profilvergleich; keine Standortfestlegung oder Betriebsfreigabe.',
  }
}
