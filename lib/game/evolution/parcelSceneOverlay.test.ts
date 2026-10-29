import { projectParcelLifecycle, type CoreParcelReceipt } from './parcelLifecycle'
import { overlayParcelProjection, type ParcelSceneBinding } from './parcelSceneOverlay'
import type { LocalSurfaceScene, LocalSurfaceBuilding } from '../spatial/localSurfaceScene'

const assert = (ok: boolean, label: string) => { if (!ok) throw Error(label) }
const old: LocalSurfaceBuilding = {
  id: 'osm:old', center: { xM: 0, yM: 0 }, widthM: 12, depthM: 10,
  rotationDeg: 0, provenance: 'observed',
}
const neighbor: LocalSurfaceBuilding = {
  id: 'osm:neighbor', center: { xM: 50, yM: 0 }, widthM: 10, depthM: 10,
  rotationDeg: 0, provenance: 'observed',
}
const newHome: LocalSurfaceBuilding = {
  id: 'house-new', center: { xM: 1, yM: 1 }, widthM: 16, depthM: 11,
  rotationDeg: 0, provenance: 'canonical',
}
const scene: LocalSurfaceScene = {
  body: 'earth', frameId: 'earth-wgs84-local-enu', radiusM: 260,
  buildings: [old, neighbor], polygons: [], paths: [], mobileObjects: [],
  roadGraph: [], railGraph: [],
}
const outline = [
  { xM: -12, yM: -12 }, { xM: 12, yM: -12 },
  { xM: 12, yM: 12 }, { xM: -12, yM: 12 },
]
const binding: ParcelSceneBinding = {
  parcelId: 'parcel-1', importedBuildingId: old.id,
  baselineBuildingId: 'house-old', parcelOutline: outline,
  canonicalBuildings: [newHome],
}
const receipts: CoreParcelReceipt[] = [
  { id: 'd', settlementId: 'seelenberg', parcelId: 'parcel-1', worldYear: 2030, sequence: 1,
    sourceEventRef: 'core:d', committed: true, change: { action: 'demolish', buildingId: 'house-old' } },
  { id: 'm', settlementId: 'seelenberg', parcelId: 'parcel-1', worldYear: 2032, sequence: 1,
    sourceEventRef: 'core:m', committed: true, change: { action: 'restore_meadow' } },
  { id: 'n', settlementId: 'seelenberg', parcelId: 'parcel-1', worldYear: 2050, sequence: 1,
    sourceEventRef: 'core:n', committed: true, change: { action: 'construct', buildingId: 'house-new' } },
]
const at = (year: number, b: ParcelSceneBinding[] = [binding], events = receipts) =>
  overlayParcelProjection({
    settlementId: 'seelenberg', scene, bindings: b,
    projection: projectParcelLifecycle({
      settlementId: 'seelenberg', baselineYear: 2026, year,
      baseline: [{ parcelId: 'parcel-1', surface: 'occupied', buildingId: 'house-old' }],
      receipts: events,
    }),
  })
const before = at(2026)
assert(before.scene.buildings.some(b => b.id === old.id), 'imported baseline building remains visible')
assert(before.scene.buildings.length === 2, 'baseline does not add phantom buildings')
const demolished = at(2030)
assert(!demolished.scene.buildings.some(b => b.id === old.id), 'demolition hides imported footprint')
assert(demolished.scene.buildings.some(b => b.id === neighbor.id), 'neighbor remains visible')
assert(demolished.scene.polygons.length === 0, 'demolition alone does not create meadow')
const meadow = at(2032)
assert(meadow.scene.polygons.some(p => p.id === 'noxia:restored-meadow:parcel-1' && p.kind === 'vegetation'), 'restoration draws meadow')
assert(!meadow.scene.buildings.some(b => b.id === old.id), 'meadow does not resurrect old house')
const rebuilt = at(2050)
assert(rebuilt.scene.buildings.some(b => b.id === 'house-new' && b.provenance === 'canonical'), 'authorized new house shown')
assert(!rebuilt.scene.buildings.some(b => b.id === old.id), 'old building remains absent')
assert(rebuilt.scene.polygons.length === 0, 'new building removes restored meadow')
const replay = overlayParcelProjection({
  settlementId: 'seelenberg', scene: rebuilt.scene,
  projection: projectParcelLifecycle({ settlementId: 'seelenberg', baselineYear: 2026, year: 2050,
    baseline: [{ parcelId: 'parcel-1', surface: 'occupied', buildingId: 'house-old' }], receipts }),
  bindings: [binding],
})
assert(JSON.stringify(replay.scene) === JSON.stringify(rebuilt.scene), 'same-year replay is idempotent')
assert(scene.buildings.length === 2 && scene.polygons.length === 0, 'source scene is never mutated')
assert(at(2050, [{ ...binding, canonicalBuildings: [] }]).gaps[0]?.reason === 'missing_canonical_building', 'unknown construction geometry is not invented')
assert(at(2032, [{ ...binding, parcelOutline: undefined }]).gaps[0]?.reason === 'missing_parcel_outline', 'unknown meadow footprint is not invented')
assert(at(2050, [{ ...binding, canonicalBuildings: [{ ...newHome, provenance: 'observed' }] }]).gaps[0]?.reason === 'missing_canonical_building', 'imported geometry cannot masquerade as new canonical building')
assert(at(2050, [{ parcelId: 'missing' }]).gaps[0]?.reason === 'unknown_parcel', 'unknown parcel does not affect scene')
assert(at(2026, [binding], [{ ...receipts[0], committed: false as true }]).scene.buildings.length === 2, 'uncommitted proposal has no effect')
let mismatched = false
try { overlayParcelProjection({
  settlementId: 'brombach', scene, bindings: [binding],
  projection: projectParcelLifecycle({ settlementId: 'seelenberg', baselineYear: 2026, year: 2026,
    baseline: [{ parcelId: 'parcel-1', surface: 'occupied', buildingId: 'house-old' }], receipts: [] }),
}) } catch { mismatched = true }
assert(mismatched, 'Brombach cannot receive Seelenberg projection')
let duplicated = false
try { at(2030, [binding, binding]) } catch { duplicated = true }
assert(duplicated, 'ambiguous duplicate bindings fail closed')
console.log('Parcel-to-scene overlay tests passed')
