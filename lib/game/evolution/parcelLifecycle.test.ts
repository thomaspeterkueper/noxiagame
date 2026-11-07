import { projectParcelLifecycle, type CoreParcelReceipt, type ParcelBaseline } from './parcelLifecycle'
const assert = (condition: boolean, label: string) => { if (!condition) throw Error(label) }
const baseline: ParcelBaseline[] = [
  { parcelId: 'parcel-1', surface: 'occupied', buildingId: 'house-1' },
  { parcelId: 'parcel-2', surface: 'cleared' },
]
const receipt = (id: string, worldYear: number, sequence: number,
  change: CoreParcelReceipt['change'], parcelId = 'parcel-1'): CoreParcelReceipt => ({
  id, settlementId: 'seelenberg', parcelId, worldYear, sequence,
  sourceEventRef: 'core:' + id, committed: true, change,
})
const events: CoreParcelReceipt[] = [
  receipt('demolition', 2030, 1, { action: 'demolish', buildingId: 'house-1' }),
  receipt('meadow', 2032, 1, { action: 'restore_meadow' }),
  receipt('new-home', 2050, 1, { action: 'construct', buildingId: 'house-2' }),
]
const at = (year: number, receipts = events) => projectParcelLifecycle({
  settlementId: 'seelenberg', baselineYear: 2026, year, baseline, receipts,
})
assert(at(2026).parcels[0].buildingId === 'house-1', 'original house is present')
assert(at(2030).parcels[0].surface === 'cleared', 'demolition leaves cleared land, not meadow')
assert(at(2031).parcels[0].surface === 'cleared', 'meadow cannot appear before restoration')
assert(at(2032).parcels[0].surface === 'meadow', 'separate restoration makes meadow')
assert(at(2049).parcels[0].surface === 'meadow', 'meadow persists until authorized rebuild')
assert(at(2050).parcels[0].buildingId === 'house-2', 'new building has new identity')
assert(at(2026).transitions.length === 0, 'future cannot leak into the past')
assert(JSON.stringify(at(2050)) === JSON.stringify(at(2050, [...events].reverse())), 'replay deterministic')
assert(baseline[0].buildingId === 'house-1', 'baseline not mutated')
assert(at(2050, [events[0], events[0]]).rejected[0].reason === 'duplicate_event', 'duplicate rejected')
assert(at(2050, [{ ...events[0], committed: false as true }]).rejected[0].reason === 'invalid_receipt', 'proposal not committed')
assert(at(2050, [receipt('bad', 2029, 1, { action: 'restore_meadow' })]).rejected[0].reason === 'invalid_transition', 'cannot restore occupied parcel')
assert(at(2050, [receipt('wrong', 2030, 1, { action: 'demolish', buildingId: 'wrong-house' })]).rejected[0].reason === 'invalid_transition', 'cannot demolish another building')
assert(at(2050, [events[0], receipt('reuse', 2031, 1, { action: 'construct', buildingId: 'house-1' })]).rejected[0].reason === 'building_identity_reused', 'retired building ID never reused')
assert(at(2050, [receipt('alien', 2030, 1, { action: 'construct', buildingId: 'house-9' }, 'unknown')]).rejected[0].reason === 'unknown_parcel', 'unknown parcel rejected')
assert(at(2050, [receipt('neighbor', 2030, 1, { action: 'demolish', buildingId: 'house-1' }), { ...events[1], settlementId: 'brombach' }]).parcels[0].surface === 'cleared', 'Brombach cannot alter Seelenberg')
assert(at(2050, [receipt('no-src', 2030, 1, { action: 'demolish', buildingId: 'house-1' })].map(e => ({ ...e, sourceEventRef: '' }))).rejected[0].reason === 'invalid_receipt', 'source provenance mandatory')
assert(at(2050, [receipt('nan-year', Number.NaN, 1, { action: 'demolish', buildingId: 'house-1' })]).rejected[0].reason === 'invalid_receipt', 'nonfinite year rejected rather than silently dropped')
assert(at(2050, [receipt('wrong-seq', 2030, -1, { action: 'demolish', buildingId: 'house-1' })]).rejected[0].reason === 'invalid_receipt', 'invalid sequence rejected')
assert(at(2050, [events[0], events[1], events[2]]).transitions.map(e => e.to).join(',') === 'cleared,meadow,occupied', 'all phases visible')
let invalidBaseline = false
try { projectParcelLifecycle({ settlementId: 'seelenberg', baselineYear: 2026, year: 2030, baseline: [...baseline, baseline[0]], receipts: [] }) } catch { invalidBaseline = true }
assert(invalidBaseline, 'duplicate baseline fails closed')
console.log('Parcel lifecycle projection tests passed')
