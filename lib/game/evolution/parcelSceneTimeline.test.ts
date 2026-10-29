import { createParcelSceneTimeline, type ParcelSceneTimelineSnapshot } from './parcelSceneTimeline'
import type { CoreParcelReceipt } from './parcelLifecycle'
import type { LocalSurfaceBuilding, LocalSurfaceScene } from '../spatial/localSurfaceScene'

const assert = (ok: boolean, message: string) => { if (!ok) throw Error(message) }
const house: LocalSurfaceBuilding = {
  id: 'osm:old', center: { xM: 0, yM: 0 }, widthM: 12, depthM: 10,
  rotationDeg: 0, provenance: 'observed',
}
const neighbor: LocalSurfaceBuilding = {
  id: 'osm:neighbor', center: { xM: 50, yM: 0 }, widthM: 10, depthM: 10,
  rotationDeg: 0, provenance: 'observed',
}
const newHouse: LocalSurfaceBuilding = {
  id: 'core:house-new', center: { xM: 1, yM: 1 }, widthM: 14, depthM: 11,
  rotationDeg: 0, provenance: 'canonical',
}
const scene: LocalSurfaceScene = {
  body: 'earth', frameId: 'earth-wgs84-local-enu', radiusM: 260,
  buildings: [house, neighbor], polygons: [], paths: [], mobileObjects: [],
  roadGraph: [], railGraph: [],
}
const receipt = (id: string, year: number, action: CoreParcelReceipt['change']): CoreParcelReceipt => ({
  id, settlementId: 'seelenberg', parcelId: 'parcel-1', worldYear: year, sequence: 1,
  sourceEventRef: 'core:' + id, committed: true, change: action,
})
const snapshot: ParcelSceneTimelineSnapshot = {
  settlementId: 'seelenberg', baselineYear: 2026,
  baseline: [{ parcelId: 'parcel-1', surface: 'occupied', buildingId: 'core:house-old' }],
  receipts: [
    receipt('demolish', 2030, { action: 'demolish', buildingId: 'core:house-old' }),
    receipt('restore', 2032, { action: 'restore_meadow' }),
    receipt('rebuild', 2050, { action: 'construct', buildingId: 'core:house-new' }),
  ],
  scene,
  bindings: [{
    parcelId: 'parcel-1', importedBuildingId: 'osm:old',
    baselineBuildingId: 'core:house-old',
    parcelOutline: [{ xM: -10, yM: -10 }, { xM: 10, yM: -10 }, { xM: 10, yM: 10 }, { xM: -10, yM: 10 }],
    canonicalBuildings: [newHouse],
  }],
}
const timeline = createParcelSceneTimeline(snapshot)
const hasBuilding = (year: number, id: string) =>
  timeline.render(year).overlay.scene.buildings.some(b => b.id === id)

assert(hasBuilding(2026, 'osm:old'), '2026 imported house visible')
assert(!hasBuilding(2030, 'osm:old'), '2030 demolished house hidden')
assert(timeline.render(2030).overlay.scene.polygons.length === 0, 'demolition is not restoration')
assert(timeline.render(2032).overlay.restoredMeadows.length === 1, '2032 meadow visible')
assert(!hasBuilding(2032, 'core:house-new'), 'future house does not leak into 2032')
assert(hasBuilding(2050, 'core:house-new'), '2050 new canonical house visible')
assert(!hasBuilding(2050, 'osm:old'), 'old house stays hidden in 2050')

// The important regression: time travel is not an overlay on the last frame.
const future = timeline.render(2050)
future.overlay.scene.buildings[0].center.xM = 9999
future.overlay.scene.polygons.push({
  id: 'renderer:temporary', kind: 'vegetation',
  points: [{ xM: 0, yM: 0 }, { xM: 1, yM: 0 }, { xM: 0, yM: 1 }],
  provenance: 'synthetic',
})
const past = timeline.render(2026)
assert(past.overlay.scene.buildings.length === 2, 'rewind restores exactly baseline buildings')
assert(past.overlay.scene.buildings.some(b => b.id === 'osm:old'), 'rewind restores imported house')
assert(!past.overlay.scene.buildings.some(b => b.id === 'core:house-new'), 'rewind removes future construction')
assert(past.overlay.scene.polygons.length === 0, 'rewind removes future meadow')
assert(past.overlay.scene.buildings.find(b => b.id === 'osm:neighbor')?.center.xM === 50,
  'renderer mutations cannot alter subsequent frames')
assert(JSON.stringify(timeline.render(2032)) === JSON.stringify(timeline.render(2032)),
  'same-year replay remains deterministic')
assert(timeline.render(2050).overlay.scene.buildings.some(b => b.id === 'osm:neighbor'),
  'unrelated neighboring buildings survive all years')

// A bad geometry binding must never hide an unrelated imported feature.
const rejectsBindings = (bindings: ParcelSceneTimelineSnapshot['bindings'], label: string,
  extra: Partial<ParcelSceneTimelineSnapshot> = {}) => {
  let rejected = false
  try { createParcelSceneTimeline({ ...snapshot, ...extra, bindings }) } catch { rejected = true }
  assert(rejected, label)
}
const bound = snapshot.bindings[0]
rejectsBindings([{ ...bound, parcelId: 'not-in-baseline' }], 'unknown parcel binding rejected')
rejectsBindings([{ ...bound, baselineBuildingId: 'core:wrong' }], 'wrong Core baseline building rejected')
rejectsBindings([{ ...bound, importedBuildingId: 'osm:missing' }], 'missing imported feature rejected')
rejectsBindings([{ ...bound, importedBuildingId: undefined }], 'unpaired baseline ID rejected')
rejectsBindings([{ ...bound, importedBuildingId: newHouse.id }], 'unloaded canonical feature cannot impersonate import')
rejectsBindings([bound, { parcelId: 'parcel-2', canonicalBuildings: [newHouse] }],
  'same canonical building cannot be assigned to two parcels',
  { baseline: [...snapshot.baseline, { parcelId: 'parcel-2', surface: 'cleared' }] })

// Changing the caller's source after timeline creation must not alter replay.
;(snapshot.receipts as CoreParcelReceipt[]).length = 0
scene.buildings[0].center.yM = 800
assert(hasBuilding(2050, 'core:house-new'), 'timeline owns a snapshot of receipts')
assert(timeline.render(2026).overlay.scene.buildings.find(b => b.id === 'osm:old')?.center.yM === 0,
  'timeline owns a snapshot of imported geometry')

const brombach = createParcelSceneTimeline({
  ...snapshot, settlementId: 'brombach',
  receipts: [receipt('cross-settlement', 2030, { action: 'demolish', buildingId: 'core:house-old' })],
  scene: { ...scene, buildings: [house, neighbor] },
})
assert(brombach.render(2050).overlay.scene.buildings.some(b => b.id === 'osm:old'),
  'Seelenberg receipts cannot alter Brombach')
let invalidYear = false
try { timeline.render(2025) } catch { invalidYear = true }
assert(invalidYear, 'before-baseline year rejected')
let invalidBody = false
try { createParcelSceneTimeline({ ...snapshot, scene: { ...scene, body: 'mars' } }) } catch { invalidBody = true }
assert(invalidBody, 'non-Earth scenes rejected')
console.log('Parcel scene timeline replay tests passed')
