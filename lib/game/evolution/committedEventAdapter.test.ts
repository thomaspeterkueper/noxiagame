import { adaptCommittedWorldEvents, type CommittedWorldReceipt } from './committedEventAdapter'
import { cityAtYear, compareCityYears, type CityAsset } from './cityChronicle'
const assert = (ok: boolean, label: string) => { if (!ok) throw new Error(label) }
const baseline: CityAsset[] = [{ id:'hall',kind:'building',name:'Alte Halle',districtId:'center',introducedYear:2026 }]
const receipt = (eventId:string,year:number,committed:boolean,change:CommittedWorldReceipt['change']):CommittedWorldReceipt =>
 ({eventId,worldYear:year,sequence:1,settlementId:'seelenberg',domain:'buildings',domainEventRef:'core:'+eventId,actorRef:'npc:lan',committed,change})
const receipts = [
 receipt('proposal',2040,false,{ action:'retire',assetId:'hall' }),
 receipt('approved',2050,true,{ action:'rename',assetId:'hall',name:'Bürgerzentrum' }),
 { ...receipt('build',2070,true,{ action:'establish',asset:{id:'lab',kind:'institution',name:'Forschungshaus',districtId:'center',introducedYear:2070} }), domain:'institutions' as const },
]
const adapted = adaptCommittedWorldEvents(receipts)
assert(adapted.events.length===2 && adapted.rejected[0].reason==='not_committed','uncommitted proposal excluded')
const at = (year:number)=> cityAtYear({settlementId:'seelenberg',year,baseline,events:adapted.events})
assert(at(2040).assets[0].name==='Alte Halle','uncommitted proposal has no effect')
assert(at(2050).assets[0].name==='Bürgerzentrum','approved change appears at correct year')
assert(at(2070).assets.length===2,'later building appears')
assert(compareCityYears(at(2026),at(2070)).added.length===1,'city diff shows new building')
// Asset creation must be owned by its corresponding authoritative Core domain.
// A receipt marked committed is insufficient if it claims a foreign asset kind.
const crossDomain = adaptCommittedWorldEvents([
  { ...receipts[2], eventId:'cross-domain', domain:'buildings', domainEventRef:'core:cross-domain' },
])
assert(crossDomain.events.length === 0 && crossDomain.rejected.length === 1 &&
  crossDomain.rejected[0].reason === 'invalid_receipt',
  'cross-domain establishment cannot enter city history')
const ownedKinds: Array<[CommittedWorldReceipt['domain'], 'building' | 'infrastructure' | 'institution' | 'service']> = [
  ['buildings','building'], ['infrastructure','infrastructure'],
  ['institutions','institution'], ['services','service'],
]
const validDomains = adaptCommittedWorldEvents(ownedKinds.map(([domain,kind],i) => ({
  ...receipt('owned-'+i,2080,true,{action:'establish',asset:{
    id:'asset-'+i,kind,name:'Authorized '+kind,districtId:'center',introducedYear:2080,
  }}),domain,
})))
assert(validDomains.events.length === 4 && validDomains.rejected.length === 0,
  'all four matching Core domains retain valid establishment receipts')
assert(adaptCommittedWorldEvents([...receipts, receipts[1]]).rejected.some(r=>r.reason==='duplicate'),'duplicate event rejected')

const malformed = [
  null,
  undefined,
  { ...receipts[1], eventId: ' ' },
  { ...receipts[1], eventId: 'bad-domain', domain: 'unknown' },
  { ...receipts[1], eventId: 'bad-year', worldYear: Number.NaN },
  { ...receipts[1], eventId: 'bad-sequence', sequence: 'one' },
  { ...receipts[1], eventId: 'bad-provenance', domainEventRef: ' ' },
  { ...receipts[1], eventId: 'bad-actor', actorRef: null },
  { ...receipts[1], eventId: 'null-change', change: null },
  { ...receipts[1], eventId: 'unknown-action', change: { action: 'demolish', assetId: 'hall' } },
  { ...receipts[1], eventId: 'bad-rename', change: { action: 'rename', assetId: 'hall', name: null } },
  { ...receipts[2], eventId: 'wrong-introduced-year',
    change: { action: 'establish', asset: { id:'lab2', kind:'institution', name:'Ungültig', districtId:'center', introducedYear: 2000 } } },
  { ...receipts[1], eventId: 'nonboolean-committed', committed: 'true' },
] as unknown as CommittedWorldReceipt[]
const checked = adaptCommittedWorldEvents(malformed)
assert(checked.events.length === 0, 'malformed receipts cannot become history')
assert(checked.rejected.length === malformed.length, 'every malformed receipt must be reported')
assert(checked.rejected.every(r => r.reason === 'invalid_receipt'), 'invalid receipt reason')
const combined = adaptCommittedWorldEvents([...malformed, ...receipts])
assert(combined.events.length === 2, 'malformed receipts cannot poison valid replay')
assert(cityAtYear({settlementId:'seelenberg',year:2070,baseline,events:combined.events}).assets.length === 2,
  'valid historical state remains reproducible')

// One source event cannot be relabeled with another eventId to replay twice.
// Both conflicting records are rejected so replay is independent of input order.
const conflictingSources = [
  { ...receipt('source-a',2050,true,{action:'rename',assetId:'hall',name:'A'}), domainEventRef:'core:one-source' },
  { ...receipt('source-b',2050,true,{action:'rename',assetId:'hall',name:'B'}), domainEventRef:'core:one-source' },
]
for (const input of [conflictingSources, [...conflictingSources].reverse()]) {
  const result = adaptCommittedWorldEvents(input)
  assert(result.events.length === 0, 'conflicting source IDs must not produce history')
  assert(result.rejected.length === 2 &&
    result.rejected.every(r => r.reason === 'ambiguous_domain_ref'),
    'all ambiguous source receipts must be reported regardless of order')
}
// Repeated source references in a different settlement are distinct Core domains.
const separateSettlements = adaptCommittedWorldEvents([
  conflictingSources[0],
  {...conflictingSources[1], settlementId:'brombach'},
])
assert(separateSettlements.events.length === 2 && separateSettlements.rejected.length === 0,
  'same source reference in another settlement must not collide')
// Invalid receipts must not veto a genuine receipt with the same source reference.
const malformedCollision = adaptCommittedWorldEvents([
  conflictingSources[0], {...conflictingSources[1], actorRef:null} as unknown as CommittedWorldReceipt,
])
assert(malformedCollision.events.length === 1 &&
  malformedCollision.rejected.length === 1 &&
  malformedCollision.rejected[0].reason === 'invalid_receipt',
  'malformed receipt cannot poison valid source event')

// One event ID cannot describe two different committed changes. Reject both,
// irrespective of input order; otherwise historical replay becomes order-dependent.
const conflictingEventId = [
  { ...receipt('shared-id', 2050, true, { action:'rename', assetId:'hall', name:'A' }),
    domainEventRef:'core:shared' },
  { ...receipt('shared-id', 2050, true, { action:'rename', assetId:'hall', name:'B' }),
    domainEventRef:'core:shared' },
]
for (const input of [conflictingEventId, [...conflictingEventId].reverse()]) {
  const result = adaptCommittedWorldEvents(input)
  assert(result.events.length === 0, 'conflicting same-ID receipts must not enter history')
  assert(result.rejected.length === 2 &&
    result.rejected.every(r => r.reason === 'ambiguous_event_id'),
    'same-ID conflict must reject both receipts in any order')
}
// Distinct provenance with the same event ID is also ambiguous.
const differentProvenance = adaptCommittedWorldEvents([
  conflictingEventId[0],
  { ...conflictingEventId[0], domainEventRef:'core:another' },
])
assert(differentProvenance.events.length === 0 &&
  differentProvenance.rejected.every(r => r.reason === 'ambiguous_event_id'),
  'same event ID must not reference two distinct source events')
// Identical duplicates retain their existing first-accepted/duplicate-rejected behavior.
const identical = adaptCommittedWorldEvents([conflictingEventId[0], { ...conflictingEventId[0] }])
assert(identical.events.length === 1 && identical.rejected.length === 1 &&
  identical.rejected[0].reason === 'duplicate', 'identical replay is a duplicate, not a conflict')
// Event IDs are scoped by settlement, including names containing delimiters.
const delimiterSafe = adaptCommittedWorldEvents([
  { ...conflictingEventId[0], settlementId:'a:b', eventId:'c' },
  { ...conflictingEventId[1], settlementId:'a', eventId:'b:c' },
])
assert(delimiterSafe.events.length === 2 && delimiterSafe.rejected.length === 0,
  'settlement/event IDs must not collide through colon concatenation')
// A malformed receipt cannot veto an otherwise valid event with the same ID.
const invalidSameId = adaptCommittedWorldEvents([
  conflictingEventId[0],
  { ...conflictingEventId[1], worldYear: Number.NaN },
])
assert(invalidSameId.events.length === 1 && invalidSameId.rejected.length === 1 &&
  invalidSameId.rejected[0].reason === 'invalid_receipt',
  'invalid same-ID candidate cannot poison valid history')

// Adaptation must detach projected history from mutable input receipts.
// Otherwise a later caller mutation could retroactively change the city view.
const mutableRename = receipt('mutable-rename', 2050, true,
  { action: 'rename', assetId: 'hall', name: 'Original' })
const projectedRename = adaptCommittedWorldEvents([mutableRename])
if (mutableRename.change.action === 'rename') mutableRename.change.name = 'Manipuliert'
assert(projectedRename.events[0]?.change.action === 'rename' &&
  projectedRename.events[0].change.name === 'Original',
  'later input mutation cannot rename historical projection')
const mutableEstablish: CommittedWorldReceipt = {
  ...receipt('mutable-build', 2080, true, { action: 'establish', asset: {
    id: 'new-lab', kind: 'institution', name: 'Original',
    districtId: 'center', introducedYear: 2080,
  } }), domain: 'institutions',
}
const projectedEstablish = adaptCommittedWorldEvents([mutableEstablish])
if (mutableEstablish.change.action === 'establish') mutableEstablish.change.asset.name = 'Manipuliert'
assert(projectedEstablish.events[0]?.change.action === 'establish' &&
  projectedEstablish.events[0].change.asset.name === 'Original',
  'later nested asset mutation cannot rewrite established historical asset')


 // Runtime Core JSON may contain private or future fields not present in the
 // public CityChange contract. Do not copy those into the city history feed.
const extraFields = [
  { ...receipt('extra-rename', 2050, true, { action: 'rename', assetId: 'hall', name: 'Public' }),
    change: { action: 'rename', assetId: 'hall', name: 'Public', privateMemo: 'secret' } },
  { ...receipt('extra-establish', 2080, true, { action: 'establish', asset: {
    id: 'public-lab', kind: 'institution', name: 'Labor',
    districtId: 'center', introducedYear: 2080,
  } }), domain: 'institutions',
    change: { action: 'establish', asset: {
      id: 'public-lab', kind: 'institution', name: 'Labor',
      districtId: 'center', introducedYear: 2080,
      privateOwnerId: 'not-for-public-history', nested: { token: 'secret' },
    } } },
] as unknown as CommittedWorldReceipt[]
const publicOnly = adaptCommittedWorldEvents(extraFields)
assert(publicOnly.events.length === 2 && publicOnly.rejected.length === 0,
  'valid receipts with extra JSON fields remain projectable')
assert(Object.keys(publicOnly.events[0].change).sort().join(',') === 'action,assetId,name',
  'private rename fields cannot leak into public history')
const publicAsset = publicOnly.events[1].change
assert(publicAsset.action === 'establish' &&
  Object.keys(publicAsset.asset).sort().join(',') ===
    'districtId,id,introducedYear,kind,name',
  'private or nested asset fields cannot leak into public history')
// The signature already ignores extra fields. Canonical output must agree:
// duplicate JSON envelopes with different private metadata cannot change
// the accepted public projection or its duplicate classification.
const extraTwin = {
  ...extraFields[1], change: { action: 'establish', asset: {
    id: 'public-lab', kind: 'institution', name: 'Labor',
    districtId: 'center', introducedYear: 2080, privateOwnerId: 'different',
  } },
} as unknown as CommittedWorldReceipt
for (const input of [[extraFields[1], extraTwin], [extraTwin, extraFields[1]]]) {
  const result = adaptCommittedWorldEvents(input)
  assert(result.events.length === 1 && result.rejected[0]?.reason === 'duplicate',
    'private metadata differences must not create ambiguous public history')
  const projected = result.events[0].change
  assert(projected.action === 'establish' &&
    Object.keys(projected.asset).sort().join(',') === 'districtId,id,introducedYear,kind,name',
    'public history shape must not depend on duplicate input order')
}

console.log('Committed city event adapter: tests passed')
