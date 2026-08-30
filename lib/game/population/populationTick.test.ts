// lib/game/population/populationTick.test.ts
// Version: 0.1.0
// Deterministische Regressionstests für NOXIA-LIVING-0001.

import { decidePopulationAction, type PopulationDecisionContext } from './decision.ts'
import { runPopulationTick } from './tick.ts'
import type {
  Person,
  PersonAssignment,
  PersonKnowledge,
  PersonNeed,
  PersonRelationship,
  PersonSkill,
} from './types.ts'

let fails = 0
function pruefe(ok: boolean, was: string): void {
  if (!ok) {
    fails++
    console.log(`\n✘ FAIL: ${was}`)
  }
}

const person: Person = {
  id: 'person-001',
  displayName: 'Testperson',
  birthYear: 2090,
  currentLocationId: 'moon-shackleton',
  simulationTier: 'active',
  activityState: 'idle',
  lastAction: null,
  lastDecisionFactors: {},
  lastTick: null,
}

const assignments: PersonAssignment[] = [
  {
    id: 'home-001',
    personId: person.id,
    assignmentType: 'home',
    locationId: 'moon-shackleton',
    tileEntityId: 'hab-1',
    employerActorId: null,
    roleCode: null,
    startsTick: 1,
    endsTick: null,
    isActive: true,
  },
  {
    id: 'work-001',
    personId: person.id,
    assignmentType: 'work',
    locationId: 'moon-mine',
    tileEntityId: 'mine-1',
    employerActorId: 'helios',
    roleCode: 'technician',
    startsTick: 1,
    endsTick: null,
    isActive: true,
  },
]

const neutralNeeds: PersonNeed[] = [
  ['sustenance', 0.8],
  ['rest', 0.8],
  ['safety', 0.9],
  ['social', 0.8],
  ['purpose', 0.7],
].map(([needCode, satisfaction]) => ({
  personId: person.id,
  needCode: needCode as PersonNeed['needCode'],
  satisfaction: satisfaction as number,
  updatedTick: 1,
}))

const skills: PersonSkill[] = [
  { personId: person.id, skillCode: 'maintenance', level: 0.8, experience: 120, updatedTick: 1 },
]

const relationships: PersonRelationship[] = [
  {
    id: 'rel-1',
    personId: person.id,
    otherPersonId: 'person-002',
    relationshipType: 'colleague',
    familiarity: 0.7,
    trust: 0.8,
    affinity: 0.6,
    lastInteractionTick: 2,
  },
]

const knowledge: PersonKnowledge[] = []

function context(overrides: Partial<PopulationDecisionContext> = {}): PopulationDecisionContext {
  return {
    person,
    needs: neutralNeeds,
    assignments,
    skills,
    relationships,
    knowledge,
    workObligation: 0.8,
    travelCostWork: 0.1,
    travelCostHome: 0.1,
    ...overrides,
  }
}

// 1. Akuter Grundbedarf schlägt Arbeit.
{
  const needs = neutralNeeds.map((need) =>
    need.needCode === 'sustenance' ? { ...need, satisfaction: 0.05 } : need,
  )
  const decision = decidePopulationAction(context({ needs }))
  pruefe(decision.action === 'satisfy_basic_need', '1. akuter Grundbedarf hat Priorität')
}

// 2. Hohe Arbeitspflicht außerhalb des Arbeitsorts führt deterministisch zur Anreise.
{
  const decision = decidePopulationAction(context({ workObligation: 1 }))
  pruefe(decision.action === 'travel_work', '2. hohe Arbeitspflicht löst travel_work aus')
}

// 3. Bekanntes, schweres und meldbares Problem kann Arbeit überstimmen.
{
  const known: PersonKnowledge[] = [{
    id: 'know-1',
    personId: person.id,
    subjectType: 'building',
    subjectRef: 'oxygen-loop-7',
    knowledgeType: 'observed_failure',
    confidence: 0.92,
    learnedTick: 4,
    sourceEventId: null,
    details: {},
  }]
  const decision = decidePopulationAction(context({
    knowledge: known,
    workObligation: 0.45,
    localProblems: [{
      subjectType: 'building',
      subjectRef: 'oxygen-loop-7',
      severity: 1,
      requiredSkill: 'maintenance',
      reportable: true,
    }],
  }))
  pruefe(decision.action === 'report_problem', '3. schweres bekanntes Problem wird gemeldet')
  pruefe(decision.factors.subjectRef === 'oxygen-loop-7', '3. Problemreferenz bleibt erklärbar erhalten')
}

// 4. Unbekanntes Problem beeinflusst die Person nicht.
{
  const decision = decidePopulationAction(context({
    workObligation: 0.9,
    localProblems: [{
      subjectType: 'building',
      subjectRef: 'unknown-failure',
      severity: 1,
      requiredSkill: 'maintenance',
      reportable: true,
    }],
  }))
  pruefe(decision.action === 'travel_work', '4. unbekanntes Problem bleibt außerhalb der Entscheidung')
}

// 5. Gleiche Eingaben erzeugen exakt dieselbe Entscheidung.
{
  const a = decidePopulationAction(context())
  const b = decidePopulationAction(context())
  pruefe(JSON.stringify(a) === JSON.stringify(b), '5. Entscheidung ist reproduzierbar')
}

// 6. Tick schreibt nur abgeleiteten Personen-/Bedarfszustand und genau ein Ereignis.
{
  const result = runPopulationTick({ ...context({ workObligation: 1 }), tick: 42 })
  pruefe(result.person.lastTick === 42, '6. Tick wird an Person gespeichert')
  pruefe(result.person.lastAction === result.decision.action, '6. lastAction entspricht Entscheidung')
  pruefe(result.events.length === 1, '6. genau ein Primärereignis pro Tick')
  pruefe(result.events[0].id === `population:42:${person.id}:${result.decision.action}`, '6. Event-ID ist deterministisch')
  pruefe(result.needs.every((need) => need.updatedTick === 42), '6. Bedarfswerte tragen aktuellen Tick')
}

// 7. travel_work verändert im reinen Tick den aktuellen Standort auf die aktive Arbeitszuweisung.
{
  const result = runPopulationTick({ ...context({ workObligation: 1 }), tick: 43 })
  pruefe(result.decision.action === 'travel_work', '7. Testvoraussetzung travel_work')
  pruefe(result.person.currentLocationId === 'moon-mine', '7. Reise endet am Arbeitsstandort')
  pruefe(result.person.activityState === 'travelling', '7. Aktivitätszustand bleibt travelling für diesen Tick')
}

if (fails > 0) {
  throw new Error(`${fails} Population-Tick-Test(s) fehlgeschlagen`)
}

console.log('✔ Population-Tick v0.1: alle deterministischen Regressionstests bestanden')
