import assert from 'node:assert/strict'
import { deriveSurfaceMissionProgress } from './surfaceProgress'
import {
  parseSurfaceRouteGeometry,
  pointAlongSurfaceRoute,
  surfaceRouteGeometryLengthM,
} from './surfaceRouteGeometry'

const snapshot = {
  kind: 'surface-vehicle-route-v1',
  distanceKm: 0.2,
  etaSeconds: 1200,
  geometry: {
    frame: 'local-world-meters',
    points: [
      { xM: 0, yM: 0, zM: 0 },
      { xM: 100, yM: 0, zM: 4 },
      { xM: 200, yM: 0, zM: 0 },
    ],
  },
}

const geometry = parseSurfaceRouteGeometry(snapshot)
assert.ok(geometry)
assert.equal(surfaceRouteGeometryLengthM(geometry), 200)
assert.deepEqual(pointAlongSurfaceRoute(geometry, 0.5), { xM: 100, yM: 0, zM: 4 })
assert.deepEqual(pointAlongSurfaceRoute(geometry, 0.75), { xM: 150, yM: 0, zM: 2 })

const halfway = deriveSurfaceMissionProgress({
  status: 'in_transit',
  started_at: '2026-09-11T10:00:00.000Z',
  arrives_at: '2026-09-11T10:20:00.000Z',
  route_snapshot: snapshot,
}, Date.parse('2026-09-11T10:10:00.000Z'))
assert.equal(halfway.phase, 'moving')
assert.equal(halfway.progress01, 0.5)
assert.equal(halfway.travelledKm, 0.1)
assert.equal(halfway.remainingSeconds, 600)

const loading = deriveSurfaceMissionProgress({ status: 'loading', route_snapshot: snapshot })
assert.equal(loading.phase, 'preparing')
assert.equal(loading.progress01, 0)

const unloading = deriveSurfaceMissionProgress({ status: 'unloading', route_snapshot: snapshot })
assert.equal(unloading.phase, 'arrived')
assert.equal(unloading.progress01, 1)

assert.equal(parseSurfaceRouteGeometry({ geometry: { frame: 'local-world-meters', points: [{ xM: 0, yM: 0 }] } }), null)
assert.equal(parseSurfaceRouteGeometry({ geometry: { frame: 'local-world-meters', points: [{ xM: 0, yM: 0 }, { xM: 'bad', yM: 0 }] } }), null)

console.log('surface progress tests passed')
