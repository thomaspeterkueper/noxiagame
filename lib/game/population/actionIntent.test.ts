import { actionIntentForDecision } from './actionIntent'
import type { PersonAssignment, PopulationDecision } from './types'

let failures = 0
function check(ok: boolean, label: string) { if (!ok) { failures++; console.error(`FAIL: ${label}`) } }

const work: PersonAssignment = { id: 'work-1', personId: 'p1', assignmentType: 'work', locationId: 'tharsis-medical', tileEntityId: 'medical-1', employerActorId: 'ssf', roleCode: 'medical_center_lead', startsTick: null, endsTick: null, isActive: true }
const home: PersonAssignment = { ...work, id: 'home-1', assignmentType: 'home', locationId: 'tharsis-hab', tileEntityId: 'hab-1', employerActorId: null, roleCode: null }
const decision = (action: PopulationDecision['action']): PopulationDecision => ({ personId: 'p1', action, score: 1, factors: {} })

const commute = actionIntentForDecision({ personId: 'p1', currentLocationId: 'tharsis-hab', assignments: [home, work], decision: decision('travel_work') })
check(commute.ok && commute.intent.kind === 'travel' && commute.intent.destinationLocationId === 'tharsis-medical' && commute.intent.destinationTileEntityId === 'medical-1', 'travel_work resolves the canonical work assignment')

const prematureWork = actionIntentForDecision({ personId: 'p1', currentLocationId: 'tharsis-hab', assignments: [home, work], decision: decision('work') })
check(!prematureWork.ok && prematureWork.reason === 'work_location_mismatch', 'work cannot execute away from the assigned workplace')

const atWork = actionIntentForDecision({ personId: 'p1', currentLocationId: 'tharsis-medical', assignments: [home, work], decision: decision('work') })
check(atWork.ok && atWork.intent.kind === 'work' && atWork.intent.tileEntityId === 'medical-1' && atWork.intent.roleCode === 'medical_center_lead', 'work intent carries facility and role identity')

const noHome = actionIntentForDecision({ personId: 'p1', currentLocationId: 'tharsis-medical', assignments: [work], decision: decision('travel_home') })
check(!noHome.ok && noHome.reason === 'missing_home_assignment', 'travel_home fails explicitly without a home assignment')

if (failures) throw new Error(`${failures} action-intent test(s) failed`)
console.log('Population action intents: tests passed')
