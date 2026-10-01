import assert from 'node:assert/strict'
import { createEarthViewAnchor } from './regions'
import { geoToLocalMeters } from './earthSpatial'

const frankfurt={lat:50.1109,lon:8.6821}
const namibia={lat:-22.9576,lon:14.5053}
const frankfurtView=createEarthViewAnchor(frankfurt)
const namibiaView=createEarthViewAnchor(namibia)

assert.match(frankfurtView.id,/^earth-view-/)
assert.equal(frankfurtView.name,'Earth · local view')
assert.deepEqual(frankfurtView.origin,frankfurt)
assert.deepEqual(geoToLocalMeters(frankfurt,frankfurtView.origin),{eastM:0,northM:0})
assert.deepEqual(geoToLocalMeters(namibia,namibiaView.origin),{eastM:0,northM:0})
assert.notEqual(frankfurtView.id,namibiaView.id)
assert.equal(frankfurtView.chunkSizeM,namibiaView.chunkSizeM)
assert.equal(frankfurtView.cellSizeM,namibiaView.cellSizeM)

console.log('Earth view anchor tests passed')
