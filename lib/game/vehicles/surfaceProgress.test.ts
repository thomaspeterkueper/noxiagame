import assert from 'node:assert/strict'
import { deriveSurfaceMissionProgress, surfaceRouteDistanceKm, surfaceRouteEtaSeconds } from './surfaceProgress'

const snapshot = { kind: 'surface-vehicle-route-v1', distanceKm: 12, etaSeconds: 1200 }
assert.equal(surfaceRouteDistanceKm(snapshot), 12)
assert.equal(surfaceRouteEtaSeconds(snapshot), 1200)
assert.equal(surfaceRouteDistanceKm({ distanceKm: -1 }), null)
assert.equal(surfaceRouteEtaSeconds({ etaSeconds: 0 }), null)

const startedAt = '2026-09-11T10:00:00.000Z'
const arrivesAt = '2026-09-11T10:20:00.000Z'
const halfway = deriveSurfaceMissionProgress({
  status: 'in_transit',
  started_at: startedAt,
  arrives_at: arrivesAt,
  route_snapshot: snapshot,
}, Date.parse('2026-09-11T10:10:00.000Z'))
assert.equal(halfway.phase, 'moving')
assert.equal(halfway.progress01, 0.5)
assert.equal(halfway.elapsedSeconds, 600)
assert.equal(halfway.remainingSeconds, 600)
assert.equal(halfway.travelledKm, 6)
assert.equal(halfway.remainingKm, 6)

const preparing = deriveSurfaceMissionProgress({ status: 'loading', route_snapshot: snapshot })
assert.equal(preparing.phase, 'preparing')
assert.equal(preparing.progress01, 0)
assert.equal(preparing.remainingSeconds, 1200)

const arrived = deriveSurfaceMissionProgress({ status: 'unloading', route_snapshot: snapshot })
assert.equal(arrived.phase, 'arrived')
assert.equal(arrived.progress01, 1)
assert.equal(arrived.remainingKm, 0)

const completed = deriveSurfaceMissionProgress({ status: 'completed', route_snapshot: snapshot })
assert.equal(completed.phase, 'finished')
assert.equal(completed.progress01, 1)

const failed = deriveSurfaceMissionProgress({ status: 'failed', route_snapshot: snapshot })
assert.equal(failed.phase, 'failed')
assert.equal(failed.progress01, 0)

console.log('Surface vehicle progress: OK')
