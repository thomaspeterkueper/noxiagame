import { buildLocalSurfaceScene } from '../spatial/localSurfaceScene'
import type { Person } from '../population/types'
import { emptyPerceptionFilterState } from './npcPerceptionFilter'
import { observeSensoryScene } from './sensoryScenePerception'
import { rememberObservation } from './npcObservationMemory'
import type { NpcMemoryState } from './npcRelationalMemory'
import type { PersonExpressiveState } from './personSensoryField'
import { learnSensoryPatterns, type SensoryPattern, type SensoryPatternState } from './sensoryPatternLearning'
import { recombineDuringDream } from './dreamRecombination'
import { updateEarlySocialLearning, type EarlySocialLearningState, type SocialSourceAssociation } from './earlySocialLearning'

export interface EarlyLifeSnapshot {
  day: number
  totalReceptions: number
  episodicObservations: number
  memories: number
  patterns: SensoryPattern[]
  dreamAssociations: number
  socialAssociations: SocialSourceAssociation[]
  distress: number
}

export interface EarlyLifeResult {
  days: number
  snapshots: EarlyLifeSnapshot[]
  memoryState: NpcMemoryState
  patternState: SensoryPatternState
  socialState: EarlySocialLearningState
}

const childId = 'newborn:early-life'

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

const scene = buildLocalSurfaceScene({
  body: 'mars',
  frameId: 'early-life-habitat',
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

function socialState(day: number, hour: number): PersonExpressiveState[] {
  const singing = hour === 6 || hour === 18
  const speech = [0, 3, 7, 10, 14, 19].includes(hour)
  const touch = [0, 1, 3, 6, 11, 14, 18, 20].includes(hour)
  const gaze = [0, 6, 10, 18].includes(hour)
  const people: PersonExpressiveState[] = [{
    person: caregiver,
    point: { xM: 0.25, yM: 0 },
    vocalExpression: singing ? 'singing' : speech ? 'speech' : 'silent',
    gazeTargetId: gaze ? childId : null,
    contactTargetIds: touch ? [childId] : [],
    emotionalArousal: singing ? 0.35 : 0.25,
  }]
  if ((day % 4 === 1 && hour === 15) || (day % 7 === 0 && hour === 7)) {
    people.push({
      person: visitor,
      point: { xM: 1.5, yM: 0.8 },
      vocalExpression: 'speech',
    })
  }
  return people
}

function awake(hour: number) {
  return [0, 3, 6, 7, 10, 11, 14, 15, 18, 19].includes(hour)
}

export function simulateNewbornEarlyLife(days: number): EarlyLifeResult {
  const boundedDays = Math.max(1, Math.floor(days))
  let filterState = emptyPerceptionFilterState()
  let memoryState: NpcMemoryState = { npcId: childId, clock: {}, memories: [], traces: [] }
  let patternState: SensoryPatternState = { patterns: [] }
  let totalReceptions = 0
  let episodicObservations = 0
  let dreamAssociations = 0
  let socialLearningState: EarlySocialLearningState = { sources: [] }
  let distress = 0.28
  const snapshots: EarlyLifeSnapshot[] = []
  const checkpoints = new Set([1, 7, 14, 30, boundedDays].filter(day => day <= boundedDays))

  for (let day = 0; day < boundedDays; day += 1) {
    for (let hour = 0; hour < 24; hour += 1) {
      const tick = day * 24 + hour
      const perceived = observeSensoryScene({
        scene,
        observerId: childId,
        observerPoint: { xM: 0, yM: 0 },
        atTick: tick,
        state: filterState,
        environment: {
          ambientLight: awake(hour) ? 0.58 : 0.12,
          ambientTemperatureC: 22.5,
        },
        profile: {
          sensitivity: { auditory: 0.92, visual: 0.62, tactile: 0.95, thermal: 0.9, olfactory: 0.8 },
          attention: { auditory: 0.72, visual: 0.38, tactile: 0.82, thermal: 0.62 },
        },
        people: socialState(day, hour),
      })

      filterState = perceived.nextState
      totalReceptions += perceived.receptions.length
      episodicObservations += perceived.emitted.length
      patternState = learnSensoryPatterns(patternState, perceived.receptions)

      // Regulation is modeled as a body-level state change. The learner only
      // credits sources that were actually present while distress decreased.
      const beforeRegulation = distress
      distress = Math.max(0, Math.min(1, distress + (awake(hour) ? 0.075 : -0.045)))
      const peopleNow = socialState(day, hour)
      const caregiverNow = peopleNow.find(entry => entry.person.id === caregiver.id)
      const caregiverRegulation =
        (caregiverNow?.contactTargetIds?.includes(childId) ? 0.18 : 0)
        + (caregiverNow?.vocalExpression === 'singing' ? 0.12 : 0)
        + (caregiverNow?.vocalExpression === 'speech' ? 0.055 : 0)
      if (caregiverRegulation > 0) distress = Math.max(0, distress - caregiverRegulation)

      const regulationEpisodes = caregiverRegulation > 0
        ? [{
            tick,
            sourceRef: 'person:' + caregiver.id,
            distressBefore: beforeRegulation,
            distressAfter: distress,
            safetyBefore: Math.max(0, 1 - beforeRegulation),
            safetyAfter: Math.max(0, 1 - distress),
            needRelief: caregiverRegulation,
          }]
        : []

      socialLearningState = updateEarlySocialLearning({
        state: socialLearningState,
        receptions: perceived.receptions,
        patterns: patternState.patterns,
        regulationEpisodes,
        distressed: beforeRegulation >= 0.34,
        atTick: tick,
      })

      for (const observation of perceived.emitted) {
        const threshold = awake(hour) ? 0.34 : 0.62
        if (observation.salience < threshold) continue
        const remembered = rememberObservation(memoryState, observation)
        memoryState = remembered.state
      }

      // One bounded dream recombination pass per night. It reorganizes lived
      // material into ephemeral associations but cannot create facts or projects.
      if (hour === 22 && memoryState.memories.length > 0) {
        const dream = recombineDuringDream({
          memoryState,
          patterns: patternState.patterns,
          creativity: {
            noveltySeeking: 0.5,
            associativeRange: 0.5,
            routineStability: 0.5,
            cognitiveFlexibility: 0.5,
            ideaThreshold: 0.65,
          },
          atTick: tick,
          maxCandidates: 3,
        })
        dreamAssociations += dream.candidates.length
      }
    }

    const completedDay = day + 1
    if (checkpoints.has(completedDay)) {
      snapshots.push({
        day: completedDay,
        totalReceptions,
        episodicObservations,
        memories: memoryState.memories.length,
        patterns: patternState.patterns.map(pattern => ({ ...pattern })),
        dreamAssociations,
        socialAssociations: socialLearningState.sources.map(source => ({ ...source })),
        distress,
      })
    }
  }

  return { days: boundedDays, snapshots, memoryState, patternState, socialState: socialLearningState }
}
