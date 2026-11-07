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

// Receipt identities are global evidence IDs, not message counts or votes.
const replay = [make('r1','a','support','book'), make('r2','b','support','conversation'), make('r3','c','support','dream')]
const replayed = deliberate({ contributions: [...replay, replay[0], replay[0]] })[0]
assert(replayed.participants === 3 && replayed.status === 'collaboration_candidate',
  'identical receipt replays do not add participants')
assert(JSON.stringify(deliberate({ contributions: [...replay, replay[0]] })) ===
  JSON.stringify(deliberate({ contributions: [replay[0], ...replay].reverse() })),
  'replays are order-independent')
const forged = make('r1','impostor','support','book')
const collision = [replay[0], forged, replay[1], replay[2]]
const collided = deliberate({ contributions: collision })[0]
assert(collided.participants === 2 && collided.status === 'discussion' &&
  !collided.collaborators.includes('impostor'), 'conflicting actor claims discard both receipts')
assert(JSON.stringify(deliberate({ contributions: collision })) ===
  JSON.stringify(deliberate({ contributions: [...collision].reverse() })),
  'conflicting receipt order does not change deliberation')
const changedStance = { ...replay[0], stance: 'oppose' as const }
assert(deliberate({ contributions: [replay[0], changedStance, replay[1], replay[2]] })[0].participants === 2,
  'same receipt ID with changed stance is rejected rather than counted as a new vote')
const reusedElsewhere = { ...replay[0], proposalKey: 'other-proposal' }
assert(deliberate({ contributions: [replay[0], reusedElsewhere] }).length === 0,
  'one receipt ID cannot support competing proposals')


// JSON event inputs are not guaranteed to satisfy the TypeScript interface.
const malformed = [
  null, undefined, 'not-a-receipt',
  { ...make('bad-source','x','support','book'), source: 'system_command' },
  { ...make('bad-stance','x','support','book'), stance: 'execute' },
  { ...make('bad-tick','x','support','book'), tick: Number.NaN },
  { ...make('infinite-tick','x','support','book'), tick: Number.POSITIVE_INFINITY },
  { ...make('negative-tick','x','support','book'), tick: -1 },
  { ...make('bad-ref','x','support','book'), sourceRefs: [null] },
  { ...make('blank-ref','x','support','book'), sourceRefs: ['   '] },
  { ...make('bad-actor','x','support','book'), actorId: ' ' },
  { ...make('bad-evidence','x','support','book'), independentEvidence: 'yes' },
  { ...make('bad-consent','x','support','book'), willingToCollaborate: 'yes' },
] as unknown as CivicContribution[]
const clean = deliberate({ contributions: replay })
const withMalformed = deliberate({ contributions: [...malformed, ...replay] })
assert(JSON.stringify(clean) === JSON.stringify(withMalformed),
  'malformed external events cannot create participants, consent, or provenance')
assert(JSON.stringify(withMalformed) === JSON.stringify(deliberate({ contributions: [...replay, ...malformed].reverse() })),
  'malformed event filtering is order-independent')
const invalidSameId = { ...replay[0], independentEvidence: 'true' } as unknown as CivicContribution
assert(JSON.stringify(deliberate({ contributions: [invalidSameId, ...replay] })) === JSON.stringify(clean),
  'invalid event cannot poison valid event with the same immutable receipt ID')
assert(deliberate({ contributions: replay, minCollaborators: Number.NaN })[0].status === 'collaboration_candidate' &&
  deliberate({ contributions: replay, minCollaborators: Number.POSITIVE_INFINITY })[0].status === 'collaboration_candidate',
  'non-finite collaborator thresholds fall back to the default instead of silently blocking proposals')
assert(deliberate({ contributions: replay, minCollaborators: 4 })[0].status === 'discussion',
  'valid stricter threshold is preserved')

console.log('Social deliberation projection: tests passed')
