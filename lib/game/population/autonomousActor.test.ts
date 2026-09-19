import { runAutonomousActorStep } from './autonomousActor'
import type { Person, PersonAssignment, PersonKnowledge, PersonNeed } from './types'

let failures = 0
function check(ok: boolean, label: string) { if (!ok) { failures++; console.error(`FAIL: ${label}`) } }

const person: Person = { id: 'npc-probe-1', displayName: 'Probe', birthYear: null, currentLocationId: 'tharsis-hab', simulationTier: 'active', activityState: 'idle', lastAction: null, lastDecisionFactors: {}, lastTick: null }
const needs: PersonNeed[] = [
  { personId: person.id, needCode: 'sustenance', satisfaction: 0.95, updatedTick: 0 },
  { personId: person.id, needCode: 'rest', satisfaction: 0.95, updatedTick: 0 },
  { personId: person.id, needCode: 'safety', satisfaction: 0.95, updatedTick: 0 },
  { personId: person.id, needCode: 'social', satisfaction: 0.95, updatedTick: 0 },
  { personId: person.id, needCode: 'purpose', satisfaction: 0.05, updatedTick: 0 },
]
const work: PersonAssignment = { id: 'work', personId: person.id, assignmentType: 'work', locationId: 'tharsis-lab', tileEntityId: 'lab-1', employerActorId: 'ssf', roleCode: 'scientist', startsTick: null, endsTick: null, isActive: true }

const ordinary = runAutonomousActorStep({ tick: 1, person, needs, assignments: [work], skills: [], relationships: [], knowledge: [], localProblems: [] })
check(ordinary.tickResult.decision.action === 'travel_work', 'autonomous actor uses ordinary population decision path')
check(ordinary.tickResult.intent.ok && ordinary.tickResult.intent.intent.kind === 'travel', 'ordinary travel intent is preserved')
check(ordinary.tickResult.person.currentLocationId === 'tharsis-hab', 'observer loop never teleports or mutates authoritative location')
check(ordinary.diagnostics.length === 0, 'valid ordinary action does not invent a problem report')

const noWork = runAutonomousActorStep({ tick: 2, person, needs, assignments: [], skills: [], relationships: [], knowledge: [], localProblems: [] })
check(noWork.tickResult.intent.ok, 'lack of assignment does not create privileged work intent')
check(noWork.diagnostics.length === 0, 'observer reports only actual canonical blockers/problems')

const knowledge: PersonKnowledge[] = [{ id: 'k1', personId: person.id, subjectType: 'facility', subjectRef: 'oxygen-loop-7', knowledgeType: 'observation', confidence: 0.9, learnedTick: 0, sourceEventId: null, details: {} }]
const problem = runAutonomousActorStep({ tick: 3, person, needs, assignments: [], skills: [{ personId: person.id, skillCode: 'maintenance', level: 0.8, experience: 0, updatedTick: 0 }], relationships: [], knowledge, localProblems: [{ subjectType: 'facility', subjectRef: 'oxygen-loop-7', severity: 1, requiredSkill: 'maintenance', reportable: true }] })
check(problem.tickResult.decision.action === 'report_problem', 'known severe reportable problem uses canonical decision scoring')
check(problem.diagnostics[0]?.kind === 'reported_problem', 'canonical report event becomes observer diagnostic')
check(problem.diagnostics[0]?.subjectRef === 'oxygen-loop-7', 'diagnostic preserves canonical problem identity')

if (failures) throw new Error(`${failures} autonomous actor test(s) failed`)
console.log('Autonomous actor observer loop: tests passed')
