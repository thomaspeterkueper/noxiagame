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
// Runtime input can come from JSON/DB rows, not only type-checked TypeScript.
// Malformed or unknown actions must fail closed without crashing or being counted as applied.
const malformed: CityHistoryEvent[] = [
  { ...events[1], id: 'unknown-action', change: { action: 'demolish', assetId: 'old-house' } as unknown as CityHistoryEvent['change'] },
  { ...events[1], id: 'missing-asset', change: { action: 'establish' } as CityHistoryEvent['change'] },
  { ...events[1], id: 'null-change', change: null as unknown as CityHistoryEvent['change'] },
  { ...events[1], id: 'invalid-rename', change: { action: 'rename', assetId: 'old-house', name: null } as unknown as CityHistoryEvent['change'] },
  { ...events[1], id: 'invalid-provenance', provenanceRefs: [null as unknown as string] },
]
const safe = snapshot(2150, malformed)
assert(safe.assets.length === 1 && safe.assets[0].name === 'Altes Haus', 'malformed events leave city unchanged')
assert(safe.appliedEventIds.length === 0 && safe.rejectedEventIds.length === malformed.length,
  'all malformed events rejected without false applied IDs')
// Untrusted JSON can contain null records and invalid sorting keys.
const malformedEnvelope: CityHistoryEvent[] = [
  null as unknown as CityHistoryEvent,
  { ...events[1], id: 'invalid-sequence', sequence: 'not-a-number' as unknown as number },
  { ...events[1], id: 'invalid-year', year: Number.NaN },
  { ...events[1], id: null as unknown as string },
  { ...events[1], settlementId: null as unknown as string },
]
const safeEnvelope = snapshot(2150, malformedEnvelope)
assert(safeEnvelope.assets.length === 1 && safeEnvelope.assets[0].id === 'old-house',
  'malformed event envelopes cannot change the city')
assert(safeEnvelope.appliedEventIds.length === 0 &&
  safeEnvelope.rejectedEventIds.length === malformedEnvelope.length,
  'all malformed envelopes rejected without crashes or false applied IDs')
assert(safeEnvelope.rejectedEventIds.includes('invalid-sequence') &&
  safeEnvelope.rejectedEventIds.includes('invalid-year'),
  'invalid sort keys explicitly rejected')
assert(snapshot(2026, [{ ...events[1], id: 'future-malformed', sequence: null as unknown as number }])
  .rejectedEventIds.length === 0, 'future event contents remain invisible')
console.log('Living Future Cities chronicle: tests passed')
