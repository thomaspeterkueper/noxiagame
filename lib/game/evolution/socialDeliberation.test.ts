import { deliberate, type CivicContribution } from './socialDeliberation'
const make = (id: string, actorId: string, stance: CivicContribution['stance'], source: CivicContribution['source'], independentEvidence = true): CivicContribution => ({
  id, actorId, proposalKey: 'reading-house', source, sourceRefs: [source + ':' + id],
  stance, tick: 100, independentEvidence, willingToCollaborate: true,
})
const assert = (ok: boolean, msg: string) => { if (!ok) throw Error(msg) }
const lone = deliberate({ contributions: [make('1','a','support','book'),make('2','a','support','book')] })[0]
assert(lone.participants === 1 && lone.status === 'discussion', 'repeating alone never creates collective initiative')
const contributions = [
  make('1','a','support','book'), make('2','b','support','conversation'),
  make('3','c','support','dream'), make('4','d','oppose','observation'),
  make('5','e','question','insight'),
]
const group = deliberate({ contributions })[0]
assert(group.status === 'collaboration_candidate', 'three independent willing participants may collaborate')
assert(group.opponents === 1 && group.questions === 1, 'dissent and questions remain visible')
assert(group.sourceKinds.includes('book') && group.sourceKinds.includes('dream'), 'literature and dream evidence recognized')
assert(group.canonical === false && group.execution === 'review_required', 'deliberation cannot authorize world mutation')
assert(JSON.stringify(deliberate({ contributions })) === JSON.stringify(deliberate({ contributions: [...contributions].reverse() })), 'order independent')
const weak = deliberate({ contributions: [
  make('1','a','support','book'), make('2','b','support','conversation',false), make('3','c','support','dream'),
] })[0]
assert(weak.status === 'discussion', 'without independent support no collaboration candidate')
console.log('Social deliberation projection: tests passed')
