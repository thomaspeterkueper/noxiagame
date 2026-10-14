import { buildLocalSurfaceScene } from '../spatial/localSurfaceScene'
import type { Person } from '../population/types'
import { emptyPerceptionFilterState } from './npcPerceptionFilter'
import { observeSensoryScene } from './sensoryScenePerception'
import { rememberObservation, type ObservationMemoryProjection } from './npcObservationMemory'
import type { NpcMemoryState } from './npcRelationalMemory'
import type { PersonExpressiveState } from './personSensoryField'

export interface NewbornDayHour {
  hour: number
  awake: boolean
  caregiverExpression?: PersonExpressiveState['vocalExpression']
  caregiverTouch?: boolean
  caregiverGaze?: boolean
  secondPersonPresent?: boolean
}

export interface NewbornDayObservation {
  hour: number
  modality: string
  sourceRef: string
  salience: number
  remembered: boolean
}

export interface NewbornDayResult {
  observations: NewbornDayObservation[]
  memoryCount: number
  memoryState: NpcMemoryState
}

function newbornProfile() {
  return {
    sensitivity: {
      auditory: 0.92,
      visual: 0.62,
      tactile: 0.95,
      thermal: 0.9,
      olfactory: 0.8,
      interoceptive: 0.9,
    },
    attention: {
      auditory: 0.72,
      visual: 0.38,
      tactile: 0.82,
      thermal: 0.62,
      olfactory: 0.55,
    },
  }
}

export function defaultFirstDaySchedule(): NewbornDayHour[] {
  return [
    { hour: 0, awake: true, caregiverExpression: 'speech', caregiverTouch: true, caregiverGaze: true },
    { hour: 1, awake: false, caregiverTouch: true },
    { hour: 2, awake: false },
    { hour: 3, awake: true, caregiverExpression: 'speech', caregiverTouch: true },
    { hour: 4, awake: false },
    { hour: 5, awake: false },
    { hour: 6, awake: true, caregiverExpression: 'singing', caregiverTouch: true, caregiverGaze: true },
    { hour: 7, awake: true, caregiverExpression: 'speech', secondPersonPresent: true },
    { hour: 8, awake: false },
    { hour: 9, awake: false },
    { hour: 10, awake: true, caregiverExpression: 'speech', caregiverGaze: true },
    { hour: 11, awake: true, caregiverTouch: true },
    { hour: 12, awake: false },
    { hour: 13, awake: false },
    { hour: 14, awake: true, caregiverExpression: 'speech', caregiverTouch: true },
    { hour: 15, awake: true, secondPersonPresent: true },
    { hour: 16, awake: false },
    { hour: 17, awake: false },
    { hour: 18, awake: true, caregiverExpression: 'singing', caregiverTouch: true, caregiverGaze: true },
    { hour: 19, awake: true, caregiverExpression: 'speech' },
    { hour: 20, awake: false, caregiverTouch: true },
    { hour: 21, awake: false },
    { hour: 22, awake: false },
    { hour: 23, awake: false },
  ]
}

export function simulateNewbornFirstDay(schedule = defaultFirstDaySchedule()): NewbornDayResult {
  const childId = 'newborn:test'
  const scene = buildLocalSurfaceScene({
    body: 'mars',
    frameId: 'first-day-habitat',
    radiusM: 30,
    buildings: [{
      id: 'habitat-home',
      center: { xM: 0, yM: 0 },
      widthM: 16,
      depthM: 12,
      rotationDeg: 0,
      provenance: 'canonical',
      label: 'Habitat',
      entityId: 'habitat',
    }],
    mobileObjects: [],
  })

  const caregiver: Person = {
    id: 'caregiver',
    displayName: 'Caregiver',
    birthYear: 2050,
    currentLocationId: 'habitat',
    simulationTier: 'active',
    activityState: 'socialising',
    lastAction: 'social_interaction',
    lastDecisionFactors: {},
    lastTick: 0,
  }
  const visitor: Person = { ...caregiver, id: 'visitor', displayName: 'Visitor', activityState: 'idle' }

  let filterState = emptyPerceptionFilterState()
  let memoryState: NpcMemoryState = { npcId: childId, clock: {}, memories: [], traces: [] }
  const observations: NewbornDayObservation[] = []

  for (const hour of schedule) {
    const people: PersonExpressiveState[] = [{
      person: caregiver,
      point: { xM: 0.25, yM: 0 },
      vocalExpression: hour.caregiverExpression ?? 'silent',
      gazeTargetId: hour.caregiverGaze ? childId : null,
      contactTargetIds: hour.caregiverTouch ? [childId] : [],
      emotionalArousal: hour.caregiverExpression === 'singing' ? 0.35 : 0.25,
    }]

    if (hour.secondPersonPresent) {
      people.push({
        person: visitor,
        point: { xM: 1.5, yM: 0.8 },
        vocalExpression: hour.awake ? 'speech' : 'silent',
      })
    }

    const perceived = observeSensoryScene({
      scene,
      observerId: childId,
      observerPoint: { xM: 0, yM: 0 },
      atTick: hour.hour,
      state: filterState,
      environment: {
        ambientLight: hour.awake ? 0.58 : 0.12,
        ambientTemperatureC: 22.5,
      },
      profile: newbornProfile(),
      people,
    })
    filterState = perceived.nextState

    for (const observation of perceived.emitted) {
      const remember = observation.salience >= (hour.awake ? 0.34 : 0.62)
      observations.push({
        hour: hour.hour,
        modality: observation.modality,
        sourceRef: observation.subjectRef,
        salience: observation.salience,
        remembered: remember,
      })
      if (!remember) continue
      const result: ObservationMemoryProjection = rememberObservation(memoryState, observation)
      memoryState = result.state
    }
  }

  return {
    observations,
    memoryCount: memoryState.memories.length,
    memoryState,
  }
}
