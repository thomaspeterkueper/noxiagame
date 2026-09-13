import assert from 'node:assert/strict'
import { buildEarthSurfaceMissionPlan } from './earthSurfaceMission'
import type { EarthSurfaceRoutePlan } from './earthSurfaceRouting'

const route: EarthSurfaceRoutePlan = {
  ok: true,
  segments: [
    {
      kind: 'access',
      featureId: null,
      routeClass: 'offroad',
      from: { lat: 51.0, lon: 7.9 },
      to: { lat: 51.0001, lon: 7.9001 },
      distanceM: 50,
      speedMultiplier: 0.42,
      energyMultiplier: 1.75,
      wearMultiplier: 2.2,
    },
    {
      kind: 'road',
      featureId: 'osm-way-42',
      routeClass: 'service-road',
      from: { lat: 51.0001, lon: 7.9001 },
      to: { lat: 51.009, lon: 7.91 },
      distanceM: 1950,
      speedMultiplier: 0.82,
      energyMultiplier: 1.12,
      wearMultiplier: 1.15,
    },
  ],
  polyline: [
    { lat: 51.0, lon: 7.9 },
    { lat: 51.0001, lon: 7.9001 },
    { lat: 51.009, lon: 7.91 },
  ],
  distanceM: 2000,
  roadDistanceM: 1950,
  offroadDistanceM: 50,
  relativeTimeCostM: 2497,
  energyMultiplier: 1.13575,
  wearMultiplier: 1.17625,
  sourceSnap: { lat: 51.0001, lon: 7.9001 },
  destinationSnap: { lat: 51.009, lon: 7.91 },
}

const plan = buildEarthSurfaceMissionPlan({
  routeId: 'earth:mine-to-depot:1',
  originInventoryId: 'inventory-mine',
  destinationInventoryId: 'inventory-depot',
  route,
})

assert.equal(plan.routeId, 'earth:mine-to-depot:1')
assert.equal(plan.originInventoryId, 'inventory-mine')
assert.equal(plan.destinationInventoryId, 'inventory-depot')
assert.equal(plan.segments.length, 2)
assert.equal(plan.segments[0].distanceKm, 0.05)
assert.equal(plan.segments[0].traversal.passable, true)
assert.equal(plan.segments[0].traversal.speedMultiplier, 0.42)
assert.equal(plan.segments[0].traversal.energyMultiplier, 1.75)
assert.equal(plan.segments[0].traversal.wearMultiplier, 2.2)
assert.equal(plan.segments[1].distanceKm, 1.95)
assert.match(plan.segments[1].id, /osm-way-42/)

assert.throws(() => buildEarthSurfaceMissionPlan({
  routeId: '',
  originInventoryId: 'a',
  destinationInventoryId: 'b',
  route,
}), /routeId is required/)

assert.throws(() => buildEarthSurfaceMissionPlan({
  routeId: 'same-node',
  originInventoryId: 'a',
  destinationInventoryId: 'a',
  route,
}), /different origin and destination/)
