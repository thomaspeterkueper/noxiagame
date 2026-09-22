import {
  earthOverlayNodeFromInventory,
  earthOverlayPathsFromPlan,
  earthOverlayRouteFromJob,
  earthOverlayRouteFromPlan,
  earthRouteFailureWarning,
} from './earthTransportOverlay'
import type { EarthSurfaceRoutePlan, EarthSurfaceRouteSegment } from './earthSurfaceRouting'
import { geoToLocalMeters, localMetersToGeo, type GeoPoint } from '../world/spatial/earthSpatial'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const origin: GeoPoint = { lat: 51.33745, lon: 7.97975 }
const point = (eastM: number, northM: number): GeoPoint => {
  const lat = origin.lat + northM / 110540
  const lon = origin.lon + eastM / (111320 * Math.cos(origin.lat * Math.PI / 180))
  return { lat, lon }
}

function roadSegment(from: GeoPoint, to: GeoPoint, routeClass: EarthSurfaceRouteSegment['routeClass']): EarthSurfaceRouteSegment {
  return {
    kind: routeClass === 'offroad' ? 'access' : 'road',
    featureId: routeClass === 'offroad' ? null : 'way/1',
    routeClass,
    from,
    to,
    distanceM: Math.hypot(geoToLocalMeters(to, from).eastM, geoToLocalMeters(to, from).northM),
    speedMultiplier: 1,
    energyMultiplier: 1,
    wearMultiplier: 1,
  }
}

const source = point(0, 0)
const snapA = point(40, 0)
const snapB = point(400, 0)
const destination = point(460, 20)

const segments = [
  roadSegment(source, snapA, 'offroad'),
  roadSegment(snapA, snapB, 'paved-road'),
]
const plan: EarthSurfaceRoutePlan = {
  ok: true,
  segments,
  polyline: [source, snapA, snapB, destination],
  distanceM: segments.reduce((sum, segment) => sum + segment.distanceM, 0),
  roadDistanceM: segments[1].distanceM,
  offroadDistanceM: segments[0].distanceM,
  relativeTimeCostM: 1,
  energyMultiplier: 1,
  wearMultiplier: 1,
  sourceSnap: snapA,
  destinationSnap: snapB,
}

const paths = earthOverlayPathsFromPlan(plan)
assert(paths.length === 2, 'a mixed route keeps one path per Earth route class')
assert(paths[0].routeClass === 'offroad' && paths[1].routeClass === 'paved-road', 'route classes must not be merged or reordered')
assert(paths[0].points[0].lat === source.lat, 'the source facility must stay the start of the first path')
assert(paths[1].points.at(-1)?.lon === destination.lon, 'the destination facility must stay the end of the last path')
assert(paths.every(path => path.points.length >= 2), 'every drawn path needs at least two points')

const sameClassPlan: EarthSurfaceRoutePlan = {
  ...plan,
  segments: [
    roadSegment(snapA, point(200, 0), 'paved-road'),
    roadSegment(point(200, 0), snapB, 'paved-road'),
  ],
}
const merged = earthOverlayPathsFromPlan(sameClassPlan)
assert(merged.length === 1, 'consecutive segments of one class collapse into a single path')

const overlay = earthOverlayRouteFromPlan({ id: 'planned-1', label: 'Test', statusLabel: 'Entwurf', plan })
assert(overlay.kind === 'planned' && overlay.progress01 === null, 'a planned route carries no Core progress')
assert(overlay.distanceM === plan.distanceM, 'the planned overlay keeps the Earth distance')
assert(overlay.warnings.length === 0, 'a validated plan has no warnings')

assert(earthRouteFailureWarning({ ok: false, reason: 'no-routable-roads' })?.includes('OSM') === true, 'route failures keep a user-facing warning')
assert(earthRouteFailureWarning(plan) === null, 'a validated plan produces no failure warning')

const local = geoToLocalMeters(point(300, 100), origin)
const snapshot = {
  kind: 'surface-vehicle-route-v1',
  passable: true,
  distanceKm: 0.5,
  etaSeconds: 60,
  earthSpatialOrigin: origin,
  geometry: {
    frame: 'local-world-meters',
    points: [
      { xM: 0, yM: 0, zM: 300 },
      { xM: local.eastM, yM: local.northM, zM: 320 },
    ],
  },
}

const jobOverlay = earthOverlayRouteFromJob({ id: 'job-1', label: 'Fahrt', statusLabel: 'Unterwegs', snapshot, progress01: 0.5 })
assert(jobOverlay.ok === true, 'a persisted Earth snapshot with origin must project onto the map')
if (jobOverlay.ok) {
  assert(jobOverlay.route.paths.length === 1 && jobOverlay.route.paths[0].routeClass === null, 'persisted geometry carries no invented Earth route class')
  assert(jobOverlay.route.distanceM === 500, 'the persisted distance must be used as-is')
  assert(jobOverlay.route.vehiclePoint != null, 'a running job exposes a vehicle point along its persisted geometry')
  const expectedVehicle = localMetersToGeo({ eastM: local.eastM / 2, northM: local.northM / 2 }, origin)
  assert(Math.abs((jobOverlay.route.vehiclePoint?.lat ?? 0) - expectedVehicle.lat) < 1e-9, 'the vehicle point must follow the persisted polyline')
  assert(Math.abs((jobOverlay.route.vehiclePoint?.lon ?? 0) - expectedVehicle.lon) < 1e-9, 'the vehicle point must follow the persisted polyline')
}

const withoutOrigin = earthOverlayRouteFromJob({
  id: 'job-2', label: 'Fahrt', statusLabel: 'Unterwegs', snapshot: { geometry: snapshot.geometry }, progress01: null,
})
assert(withoutOrigin.ok === false, 'geometry without a reference origin must not be drawn against a guessed origin')

const withoutGeometry = earthOverlayRouteFromJob({ id: 'job-3', label: 'Fahrt', statusLabel: 'Unterwegs', snapshot: { kind: 'surface-vehicle-route-v1' }, progress01: null })
assert(withoutGeometry.ok === false, 'a snapshot without geometry must not get a substitute route')

const storageNode = earthOverlayNodeFromInventory({
  id: 'storage-1', label: 'Raumhafenlager', inventory_kind: 'depot', metadata: { role: 'spaceport_storage' },
}, { lat: 51.3, lon: 7.9 })
assert(storageNode?.kind === 'spaceport-storage', 'a Core spaceport warehouse must be marked as the handover stop')
assert(storageNode?.id === 'inventory:storage-1', 'overlay node ids must stay namespaced to the Core inventory')
assert(Math.abs((storageNode?.point.lon ?? 0) - 7.9) < 1e-9, 'a valid Core position must be published unchanged')

const wrappedNode = earthOverlayNodeFromInventory({ id: 'pad-1', label: 'Pad', inventory_kind: 'surface_port' }, { lat: 51.3, lon: 187.9 })
assert(Math.abs((wrappedNode?.point.lon ?? 0) - -172.1) < 1e-9, 'longitudes must be normalised before the map projects them')

assert(earthOverlayNodeFromInventory(
  { id: 'broken', label: 'Unaufgelöst', inventory_kind: 'location' },
  { lat: Number.NaN, lon: 7.9 },
) === null, 'an unresolvable Core position must not be published as a guessed map node')

console.log('earth transport overlay tests passed')
