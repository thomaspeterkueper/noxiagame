import { strict as assert } from 'node:assert'
import { EARTH_LANDMARKS } from './earthLandmarks'
import { BAYT_AL_MIRA_JOURNEY } from './earthHistoricalJourneys'

const journey = BAYT_AL_MIRA_JOURNEY
assert.equal(journey.stops.length, 10)
assert.equal(journey.legs.length, journey.stops.length - 1)

const stations = journey.stops.filter(stop => stop.phase === 'station')
assert.deepEqual(stations.map(stop => stop.station), [1, 2, 3, 4, 5, 6, 7, 8, 9])
assert.deepEqual(
  stations.map(stop => stop.label),
  ['Kyrene', 'Karthago / Tunis', 'Palermo / Sizilien', 'Malta', 'Kreta', 'Zypern', 'Rhodos', 'Alexandria', 'Tripolitanien'],
)

const landmarkIds = new Set(EARTH_LANDMARKS.map(landmark => landmark.id))
for (const stop of journey.stops) {
  assert.ok(landmarkIds.has(stop.landmarkId), `unknown landmark for journey stop ${stop.id}: ${stop.landmarkId}`)
}

for (let index = 0; index < journey.legs.length; index += 1) {
  assert.equal(journey.legs[index].from, journey.stops[index].id)
  assert.equal(journey.legs[index].to, journey.stops[index + 1].id)
  assert.equal(journey.legs[index].relation, 'narrative-sequence')
}

assert.equal(journey.stops[0].landmarkId, 'earth-eg-alexandria')
assert.equal(stations[7].landmarkId, 'earth-eg-alexandria')
assert.ok(!journey.stops.some(stop => stop.landmarkId === 'earth-es-cadiz'))
assert.ok(!journey.stops.some(stop => stop.landmarkId === 'earth-eg-cairo'))

console.log('earth historical journey tests passed')
