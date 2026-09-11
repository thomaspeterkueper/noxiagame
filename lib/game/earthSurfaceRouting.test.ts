import type { ImportedEarthFeature } from '../world/spatial/earthFeatureSource'
import { assessEarthOffroad } from './earthSurfaceLogistics'
import { planEarthSurfaceRoute } from './earthSurfaceRouting'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function road(
  id: string,
  coordinates: Array<{ lat: number; lon: number }>,
  properties: Record<string, string>,
): ImportedEarthFeature {
  return {
    id,
    worldId: 'earth',
    featureType: 'road',
    geometryKind: 'line',
    properties,
    geometry: { kind: 'line', coordinates },
  }
}

const A = { lat: 51, lon: 8 }
const B = { lat: 51, lon: 8.001 }
const C = { lat: 51, lon: 8.002 }
const D = { lat: 51.001, lon: 8.001 }

const roads: ImportedEarthFeature[] = [
  road('primary', [A, B, C], { highway: 'primary', surface: 'asphalt' }),
  road('track', [B, D], { highway: 'track', surface: 'gravel' }),
]

const access = assessEarthOffroad(
  { slopeDeg: 1, landuse: 'meadow' },
  { role: 'cargo-rover', safeLongitudinalSlopeDeg: 12 },
)
assert(access.passable, 'reference last-mile terrain must be passable')

const mixed = planEarthSurfaceRoute({
  features: roads,
  source: { lat: 50.99995, lon: 8.0001 },
  destination: { lat: 51.00095, lon: 8.001 },
  vehicleRole: 'cargo-rover',
  sourceAccess: access,
  destinationAccess: access,
})
assert(mixed.ok, 'connected OSM road graph with short passable access must produce a route')
if (mixed.ok) {
  assert(mixed.roadDistanceM > 0, 'route must include observed road distance')
  assert(mixed.offroadDistanceM > 0, 'nearby facilities may use explicit short offroad connectors')
  assert(mixed.segments.some(segment => segment.routeClass === 'paved-road'), 'route must preserve paved-road segment class')
  assert(mixed.segments.some(segment => segment.routeClass === 'track'), 'route must preserve track segment class')
  assert(mixed.energyMultiplier > 1, 'mixed route must expose a relative energy penalty above paved-road baseline')
  assert(mixed.polyline.length >= 3, 'route must expose a drawable polyline')
}

const onRoad = planEarthSurfaceRoute({
  features: roads,
  source: A,
  destination: C,
  vehicleRole: 'cargo-rover',
})
assert(onRoad.ok, 'points on observed road geometry must not require offroad assessment')
if (onRoad.ok) assert(onRoad.offroadDistanceM < 0.5, 'on-road route must not invent offroad access')

const pedestrianOnly = planEarthSurfaceRoute({
  features: [road('footway', [A, B], { highway: 'footway' })],
  source: A,
  destination: B,
  vehicleRole: 'cargo-rover',
})
assert('reason' in pedestrianOnly, 'footway must not become a vehicle routing network')
if ('reason' in pedestrianOnly) assert(pedestrianOnly.reason === 'no-routable-roads', 'footway must fail because no routable roads exist')

const secondA = { lat: 51.01, lon: 8.01 }
const secondB = { lat: 51.01, lon: 8.011 }
const disconnected = planEarthSurfaceRoute({
  features: [
    road('network-a', [A, B], { highway: 'primary', surface: 'asphalt' }),
    road('network-b', [secondA, secondB], { highway: 'primary', surface: 'asphalt' }),
  ],
  source: A,
  destination: secondB,
  vehicleRole: 'cargo-rover',
})
assert('reason' in disconnected, 'separate OSM road components must remain disconnected')
if ('reason' in disconnected) assert(disconnected.reason === 'disconnected-road-network', 'disconnected road components must report the correct failure')

const oneWay = planEarthSurfaceRoute({
  features: [road('oneway', [A, B], { highway: 'primary', surface: 'asphalt', oneway: 'yes' })],
  source: B,
  destination: A,
  vehicleRole: 'cargo-rover',
})
assert('reason' in oneWay, 'reverse travel on a one-way road must be rejected')
if ('reason' in oneWay) assert(oneWay.reason === 'disconnected-road-network', 'oneway direction must produce a disconnected route in reverse')

const tooFarFromRoad = planEarthSurfaceRoute({
  features: roads,
  source: { lat: 50.998, lon: 8 },
  destination: C,
  vehicleRole: 'cargo-rover',
  sourceAccess: access,
})
assert('reason' in tooFarFromRoad, 'long unmapped facility access must not be fabricated')
if ('reason' in tooFarFromRoad) assert(tooFarFromRoad.reason === 'source-access-unresolved', 'overlong access must report source access unresolved')

console.log('earth surface routing tests passed')
