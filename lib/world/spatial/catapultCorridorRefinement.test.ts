import assert from 'node:assert/strict'
import type { CatapultCorridorCandidate } from './catapultCorridorAnalysis'
import { catapultProfilePoints, compareRefinedCatapultCorridors, refineCatapultCorridor } from './catapultCorridorRefinement'

function candidate(rank: number): CatapultCorridorCandidate {
  return {
    id: `h${rank}`, rank, score: 90, start: { lat: 51, lon: 8 }, end: { lat: 51.02, lon: 8 }, azimuthDeg: 0,
    analysedLengthM: 2_000, elevationGainM: 100, averageGradePercent: 5, maxSegmentGradePercent: 6,
    gradeVariationPercent: 1, monotonicClimbShare: 1, sundernHubDistanceM: 5_000, selmeckeDistanceM: 4_000,
    departureConflictDistanceM: null, departureConflictType: null, sourceResolutionM: 700, profile: [],
    planningStatus: 'terrain-screening-only', orbitalAzimuthStatus: 'mission-profile-unresolved', geologyStatus: 'unresolved', notes: [],
  }
}

const h1 = candidate(1)
const points = catapultProfilePoints(h1, 100)
assert.equal(points.length, 21)
assert.deepEqual(points[0], h1.start)
assert.deepEqual(points.at(-1), h1.end)

const rising = points.map((point, index) => ({ ...point, elevationM: 300 + index * 10 }))
const refinedH1 = refineCatapultCorridor(h1, rising)
assert.equal(refinedH1.sampleSpacingM, 100)
assert.equal(refinedH1.elevationGainM, 200)
assert.equal(refinedH1.averageGradePercent, 10)
assert.equal(refinedH1.monotonicClimbShare, 1)
assert.equal(refinedH1.terrainVerdict, 'plausible')

const h2 = candidate(2)
const uneven = points.map((point, index) => ({ ...point, elevationM: index % 2 ? 340 : 300 }))
const refinedH2 = refineCatapultCorridor(h2, uneven)
assert.equal(refinedH2.terrainVerdict, 'concerning')
assert.equal(compareRefinedCatapultCorridors([refinedH2, refinedH1]).leadingCandidateId, h1.id)

console.log('catapult corridor refinement tests passed')
