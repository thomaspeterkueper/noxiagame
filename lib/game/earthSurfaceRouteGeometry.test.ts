import assert from 'node:assert/strict'
import { attachEarthSurfaceRouteGeometry, buildEarthSurfaceRouteGeometry } from './earthSurfaceRouteGeometry'
import type { EarthSurfaceRoutePlan } from './earthSurfaceRouting'
import { pointAlongSurfaceRoute, surfaceRouteGeometryLengthM } from './vehicles/surfaceRouteGeometry'

const origin = { lat: 51, lon: 7.9 }
const route: EarthSurfaceRoutePlan = {
  ok: true,
  segments: [{
    kind: 'road',
    featureId: 'osm-way-1',
    routeClass: 'service-road',
    from: origin,
    to: { lat: 51, lon: 7.901 },
    distanceM: 70,
    speedMultiplier: 1,
    energyMultiplier: 1,
    wearMultiplier: 1,
  }],
  polyline: [origin, { lat: 51, lon: 7.901 }],
  distanceM: 70,
  roadDistanceM: 70,
  offroadDistanceM: 0,
  relativeTimeCostM: 70,
  energyMultiplier: 1,
  wearMultiplier: 1,
  sourceSnap: origin,
  destinationSnap: { lat: 51, lon: 7.901 },
}

const geometry = buildEarthSurfaceRouteGeometry(route, origin)
assert.equal(geometry.frame, 'local-world-meters')
assert.equal(geometry.points.length, 2)
assert(Math.abs(geometry.points[0].xM) < 1e-9)
assert(Math.abs(geometry.points[0].yM) < 1e-9)
assert(surfaceRouteGeometryLengthM(geometry) > 60)
assert(surfaceRouteGeometryLengthM(geometry) < 80)

const midpoint = pointAlongSurfaceRoute(geometry, .5)
assert(midpoint.xM > 30 && midpoint.xM < 40)
assert(Math.abs(midpoint.yM) < 1)

const snapshot = attachEarthSurfaceRouteGeometry({ kind: 'surface-vehicle-route-v1', etaSeconds: 60 }, route, origin)
assert.equal(snapshot.kind, 'surface-vehicle-route-v1')
assert.equal(snapshot.etaSeconds, 60)
assert.equal(snapshot.geometry.frame, 'local-world-meters')
assert.equal(snapshot.geometry.points.length, 2)

assert.throws(() => buildEarthSurfaceRouteGeometry({ ...route, polyline: [origin] }, origin), /at least two/)

console.log('earth surface route geometry tests passed')
