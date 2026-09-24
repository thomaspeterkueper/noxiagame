import assert from 'node:assert/strict'
import { SELMECKE_REFERENCE_SITE } from './earthReferenceSites'
import { analyseSpaceportCorridors } from './spaceportCorridorAnalysis'
import type { TerrainSuitabilityCell } from './siteSuitability'
import type { SpaceportShortlistCandidate } from './spaceportShortlist'

const start=SELMECKE_REFERENCE_SITE.point
const oneKmNorth=1_000/111_320

const site={
  lat:start.lat+oneKmNorth,
  lon:start.lon,
  shortlistRank:1,
  shortlistLabel:'A',
  shortlistReason:'contract test',
} as SpaceportShortlistCandidate

function terrain(distanceM:number,elevationM:number,slopePercent:number):TerrainSuitabilityCell{
  return {
    lat:start.lat+distanceM/111_320,
    lon:start.lon,
    elevationM,
    slopePercent,
    reliefM:5,
    terrainScore:70,
  }
}

const result=analyseSpaceportCorridors([site],[
  terrain(0,300,2),
  terrain(500,325,7),
  terrain(1_000,340,4),
],500)[0]

assert(Math.abs(result.straightLineDistanceM-1_000)<=1)
assert.equal(result.sampledCells,3)
assert.equal(result.elevationDeltaM,40)
assert.equal(result.surfaceReliefM,40)
assert.equal(result.maxObservedSurfaceSlopePercent,7)
assert.equal(result.maxProfileGradePercent,5)
assert.equal(result.tunnelShare,null)
assert.deepEqual(result.portalCandidates,[])
assert.equal(result.engineeringStatus,'screening-only')
assert(result.notes.some(note=>note.includes('Detail-DEM')))

console.log('spaceport corridor analysis tests passed')
