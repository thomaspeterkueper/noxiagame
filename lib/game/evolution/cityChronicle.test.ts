import { cityAtYear, compareCityYears, type CityAsset, type CityHistoryEvent } from './cityChronicle'
const assert = (ok: boolean, label: string) => { if (!ok) throw Error(label) }
const baseline: CityAsset[] = [{ id: 'old-house', kind: 'building', name: 'Altes Haus', districtId: 'center', introducedYear: 2026 }]
const events: CityHistoryEvent[] = [
  { id: 'e3', settlementId: 'seelenberg', year: 2100, sequence: 1, committed: true, provenanceRefs: ['domain:build:e3'], change: { action: 'rename', assetId: 'institute', name: 'Institut für Gemeinschaftsforschung' } },
  { id: 'e2', settlementId: 'seelenberg', year: 2050, sequence: 2, committed: true, provenanceRefs: ['domain:build:e2'], change: { action: 'establish', asset: { id: 'institute', kind: 'institution', name: 'Bürgerlabor', districtId: 'west', introducedYear: 2050 } } },
  { id: 'e1', settlementId: 'seelenberg', year: 2050, sequence: 1, committed: true, provenanceRefs: ['domain:build:e1'], change: { action: 'retire', assetId: 'old-house' } },
  { id: 'foreign', settlementId: 'elsewhere', year: 2030, sequence: 1, committed: true, provenanceRefs: ['domain:build:foreign'], change: { action: 'retire', assetId: 'old-house' } },
]
const snapshot = (year: number, history = events) => cityAtYear({ settlementId: 'seelenberg', year, baseline, events: history })
const early = snapshot(2026)
const mid = snapshot(2050)
const late = snapshot(2150)
assert(early.assets.length === 1 && early.assets[0].id === 'old-house', 'past state remains visible')
assert(mid.assets.length === 1 && mid.assets[0].name === 'Bürgerlabor', 'build and retire affect the right year')
assert(late.assets[0].name === 'Institut für Gemeinschaftsforschung', 'renaming affects later years')
assert(JSON.stringify(late) === JSON.stringify(snapshot(2150, [...events].reverse())), 'event order deterministic')
assert(early.assets[0].name === 'Altes Haus', 'later projections do not mutate past')
const diff = compareCityYears(early, late)
assert(diff.added.length === 1 && diff.removed.length === 1, 'century comparison shows change')
assert(snapshot(2040).assets.length === 1, 'no future knowledge leaks')
const rejected = snapshot(2150, [...events, { ...events[1], id: 'invalid', provenanceRefs: [] }])
assert(rejected.rejectedEventIds.includes('invalid'), 'unproven event rejected')
assert(snapshot(2150, [...events, events[0]]).rejectedEventIds.includes('e3'), 'duplicate event rejected')
assert(snapshot(2150, [{ ...events[1], committed: false as true }]).assets.length === 1, 'uncommitted events cannot mutate projection')
let differentSettlement = false
try { compareCityYears(early, { ...late, settlementId: 'other' }) } catch { differentSettlement = true }
assert(differentSettlement, 'different settlements cannot be compared')
console.log('Living Future Cities chronicle: tests passed')
