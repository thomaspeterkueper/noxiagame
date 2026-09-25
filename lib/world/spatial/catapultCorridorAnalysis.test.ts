import assert from 'node:assert/strict'
import { analyseCatapultCorridors } from './catapultCorridorAnalysis'
import { EARTH_SAUERLAND_REGION } from './regions'
import type { TerrainSuitabilityCell } from './siteSuitability'

const origin = EARTH_SAUERLAND_REGION.origin
const cells: TerrainSuitabilityCell[] = []
for (let north = -3_000; north <= 3_000; north += 500) {
  for (let east = -3_000; east <= 3_000; east += 500) {
    cells.push({
      lat: origin.lat + north / 111_320,
      lon: origin.lon + east / (111_320 * Math.cos(origin.lat * Math.PI / 180)),
      elevationM: 300 + north * .06,
      slopePercent: 6,
      reliefM: 30,
      terrainScore: 55,
    })
  }
}

const screening = analyseCatapultCorridors(cells, [], 500, 3)
assert.equal(screening.status, 'planning-only-not-canonical')
assert.equal(screening.hub.precision, 'regional-anchor-only')
assert.ok(screening.candidates.length > 0)
assert.ok(screening.candidates.length <= 3)
assert.ok(screening.candidates[0].azimuthDeg <= 22.5 || screening.candidates[0].azimuthDeg >= 337.5)
assert.ok(screening.candidates[0].averageGradePercent >= 4)
assert.equal(screening.candidates[0].orbitalAzimuthStatus, 'mission-profile-unresolved')
assert.equal(screening.candidates[0].geologyStatus, 'unresolved')

console.log('catapult corridor analysis tests passed')
