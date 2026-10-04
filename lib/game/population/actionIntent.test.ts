import { actionIntentForDecision } from './actionIntent'
import type { PersonAssignment, PersonKnowledge, PersonRelationship, PopulationDecision } from './types'

let failures = 0
function check(ok: boolean, label: string) { if (!ok) { failures++; console.error(`FAIL: ${label}`) } }

const work: PersonAssignment = { id: 'work-1', personId: 'p1', assignmentType: 'work', locationId: 'tharsis-medical', tileEntityId: 'medical-1', employerActorId: 'ssf', roleCode: 'medical_center_lead', startsTick: null, endsTick: null, isActive: true }
const home: PersonAssignment = { ...work, id: 'home-1', assignmentType: 'home', locationId: 'tharsis-hab', tileEntityId: 'hab-1', employerActorId: null, roleCode: null }
const decision = (action: PopulationDecision['action']): PopulationDecision => ({ personId: 'p1', action, score: 1, factors: {} })

const commute = actionIntentForDecision({ personId: 'p1', currentLocationId: 'tharsis-hab', assignments: [home, work], decision: decision('travel_work') })
check(commute.ok && commute.intent.kind === 'travel' && commute.intent.destinationLocationId === 'tharsis-medical' && commute.intent.destinationTileEntityId === 'medical-1', 'travel_work resolves the canonical work assignment')

const prematureWork = actionIntentForDecision({ personId: 'p1', currentLocationId: 'tharsis-hab', assignments: [home, work], decision: decision('work') })
check('reason' in prematureWork && prematureWork.reason === 'work_location_mismatch', 'work cannot execute away from the assigned workplace')

const atWork = actionIntentForDecision({ personId: 'p1', currentLocationId: 'tharsis-medical', assignments: [home, work], decision: decision('work') })
check(atWork.ok && atWork.intent.kind === 'work' && atWork.intent.tileEntityId === 'medical-1' && atWork.intent.roleCode === 'medical_center_lead', 'work intent carries facility and role identity')

const noHome = actionIntentForDecision({ personId: 'p1', currentLocationId: 'tharsis-medical', assignments: [work], decision: decision('travel_home') })
check('reason' in noHome && noHome.reason === 'missing_home_assignment', 'travel_home fails explicitly without a home assignment')


const unknownProblem = actionIntentForDecision({
  personId: 'p1',
  currentLocationId: 'tharsis-hab',
  assignments: [home],
  decision: { personId: 'p1', action: 'inspect_problem', score: 1, factors: { subjectRef: 'pump-1' } },
  simulationTier: 'active',
  relationships: [],
  knowledge: [],
})
check('reason' in unknownProblem && unknownProblem.reason === 'unknown_subject', 'inspection requires personal knowledge of the subject')

const knownProblem: PersonKnowledge = {
  id: 'knowledge-1',
  personId: 'p1',
  subjectType: 'building',
  subjectRef: 'pump-1',
  knowledgeType: 'observed_failure',
  confidence: 0.8,
  learnedTick: 10,
  sourceEventId: null,
  details: {},
}
const inspectKnown = actionIntentForDecision({
  personId: 'p1',
  currentLocationId: 'tharsis-hab',
  assignments: [home],
  decision: { personId: 'p1', action: 'inspect_problem', score: 1, factors: { subjectRef: 'pump-1' } },
  simulationTier: 'active',
  relationships: [],
  knowledge: [knownProblem],
})
check(inspectKnown.ok && inspectKnown.intent.kind === 'local', 'known problems may produce an inspection intent')

const noSocialTarget = actionIntentForDecision({
  personId: 'p1',
  currentLocationId: 'tharsis-hab',
  assignments: [home],
  decision: decision('social_interaction'),
  simulationTier: 'active',
  relationships: [],
  knowledge: [],
})
check('reason' in noSocialTarget && noSocialTarget.reason === 'missing_social_target', 'social action requires a relationship target')

const relation: PersonRelationship = {
  id: 'relationship-1',
  personId: 'p1',
  otherPersonId: 'p2',
  relationshipType: 'acquaintance',
  familiarity: 0.4,
  trust: 0.5,
  affinity: 0.6,
  lastInteractionTick: 3,
}
const socialTarget = actionIntentForDecision({
  personId: 'p1',
  currentLocationId: 'tharsis-hab',
  assignments: [home],
  decision: decision('social_interaction'),
  simulationTier: 'active',
  relationships: [relation],
  knowledge: [],
})
check(socialTarget.ok && socialTarget.intent.kind === 'local', 'social action is available with a relationship target')

if (failures) throw new Error(`${failures} action-intent test(s) failed`)
console.log('Population action intents: tests passed')
