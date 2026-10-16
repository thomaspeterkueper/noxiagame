import {
  createCreativeSeed,
  startCreativeProject,
  updateCreativeInterests,
  type CreativeDisposition,
  type CreativeInterest,
  type CreativeProject,
  type CreativeSkillProfile,
  type CreativeStimulus,
} from './npcCreativeProcess'

export const LIFE_HOURS_PER_DAY = 24
export const LIFE_DAYS_PER_WEEK = 7
export const LIFE_DAYS_PER_YEAR = 365
export const LIFE_HOURS_PER_YEAR = LIFE_HOURS_PER_DAY * LIFE_DAYS_PER_YEAR

export type DevelopmentStage =
  | 'newborn'
  | 'infant'
  | 'toddler'
  | 'early_childhood'
  | 'middle_childhood'
  | 'adolescent'
  | 'adult'

export interface DevelopmentCapacity {
  sensoryEncoding: number
  memoryRetention: number
  socialLearning: number
  motorAgency: number
  symbolicThought: number
  creativeAgency: number
}

export interface LifeCourseExposure {
  hour: number
  stimulus: CreativeStimulus
}

export interface LifeCourseState {
  npcId: string
  ageHours: number
  stage: DevelopmentStage
  capacity: DevelopmentCapacity
  interests: CreativeInterest[]
  skills: CreativeSkillProfile
  projects: CreativeProject[]
  exposureCount: number
  sleepCycles: number
}

export interface LifeCourseSnapshot {
  hour: number
  ageDays: number
  ageYears: number
  stage: DevelopmentStage
  capacity: DevelopmentCapacity
  interests: CreativeInterest[]
  skills: CreativeSkillProfile
  projects: CreativeProject[]
  exposureCount: number
  sleepCycles: number
}

export interface LifeCourseScenario {
  npcId: string
  disposition: CreativeDisposition
  exposures: LifeCourseExposure[]
  endHour: number
  snapshotHours?: number[]
}

const unit = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0

export function developmentStage(ageHours: number): DevelopmentStage {
  const days = Math.max(0, ageHours) / LIFE_HOURS_PER_DAY
  const years = days / LIFE_DAYS_PER_YEAR
  if (days < 28) return 'newborn'
  if (years < 1) return 'infant'
  if (years < 3) return 'toddler'
  if (years < 6) return 'early_childhood'
  if (years < 12) return 'middle_childhood'
  if (years < 18) return 'adolescent'
  return 'adult'
}

function ramp(ageYears: number, start: number, full: number): number {
  if (ageYears <= start) return 0
  if (ageYears >= full) return 1
  return unit((ageYears - start) / (full - start))
}

/**
 * Developmental gate for the life-course experiment.
 *
 * It is deliberately coarse: this is a simulation policy, not a claim that
 * human development follows exact universal thresholds.
 */
export function developmentalCapacity(ageHours: number): DevelopmentCapacity {
  const years = Math.max(0, ageHours) / LIFE_HOURS_PER_YEAR
  return {
    sensoryEncoding: unit(0.35 + ramp(years, 0, 0.5) * 0.65),
    memoryRetention: unit(0.12 + ramp(years, 0.15, 4) * 0.88),
    socialLearning: unit(0.25 + ramp(years, 0, 5) * 0.75),
    motorAgency: ramp(years, 0.35, 6),
    symbolicThought: ramp(years, 1.2, 8),
    creativeAgency: ramp(years, 1.8, 10),
  }
}

function scaleStimulusForDevelopment(stimulus: CreativeStimulus, capacity: DevelopmentCapacity): CreativeStimulus {
  return {
    ...stimulus,
    emotionalWeight: unit(stimulus.emotionalWeight * (0.55 + capacity.socialLearning * 0.45)),
    novelty: unit(stimulus.novelty * (0.7 + capacity.sensoryEncoding * 0.3)),
    salience: unit(stimulus.salience * capacity.sensoryEncoding),
  }
}

function learnSkill(
  skills: CreativeSkillProfile,
  domain: keyof CreativeSkillProfile,
  amount: number,
): CreativeSkillProfile {
  return {
    ...skills,
    [domain]: unit((skills[domain] ?? 0) + Math.max(0, amount)),
  }
}

function sleepHoursForAge(ageHours: number): number {
  const years = ageHours / LIFE_HOURS_PER_YEAR
  if (years < 0.25) return 16
  if (years < 1) return 14
  if (years < 3) return 12
  if (years < 6) return 11
  if (years < 13) return 10
  if (years < 18) return 9
  return 8
}

function isSleepHour(ageHours: number): boolean {
  const hourOfDay = Math.floor(ageHours) % LIFE_HOURS_PER_DAY
  const sleepHours = sleepHoursForAge(ageHours)
  if (sleepHours >= 14) {
    // Infants sleep in several blocks; this deterministic pattern approximates
    // distributed sleep without pretending to model a specific baby.
    return hourOfDay < 6 || (hourOfDay >= 9 && hourOfDay < 12) || (hourOfDay >= 14 && hourOfDay < 17) || hourOfDay >= 20
  }
  return hourOfDay < Math.ceil(sleepHours * 0.55) || hourOfDay >= 24 - Math.floor(sleepHours * 0.45)
}

export function createNewbornLifeCourse(npcId: string): LifeCourseState {
  return {
    npcId,
    ageHours: 0,
    stage: 'newborn',
    capacity: developmentalCapacity(0),
    interests: [],
    skills: {},
    projects: [],
    exposureCount: 0,
    sleepCycles: 0,
  }
}

function snapshot(state: LifeCourseState): LifeCourseSnapshot {
  return {
    hour: state.ageHours,
    ageDays: state.ageHours / LIFE_HOURS_PER_DAY,
    ageYears: state.ageHours / LIFE_HOURS_PER_YEAR,
    stage: state.stage,
    capacity: { ...state.capacity },
    interests: state.interests.map(entry => ({ ...entry })),
    skills: { ...state.skills },
    projects: state.projects.map(project => ({ ...project })),
    exposureCount: state.exposureCount,
    sleepCycles: state.sleepCycles,
  }
}

/**
 * Runs every simulated hour from birth to endHour.
 * No LLM, persistence or canonical world mutation occurs here.
 */
export function runLifeCourseScenario(scenario: LifeCourseScenario): LifeCourseSnapshot[] {
  let state = createNewbornLifeCourse(scenario.npcId)
  const exposuresByHour = new Map<number, CreativeStimulus[]>()
  for (const exposure of scenario.exposures) {
    const list = exposuresByHour.get(exposure.hour) ?? []
    list.push(exposure.stimulus)
    exposuresByHour.set(exposure.hour, list)
  }

  const requested = new Set([
    24,
    7 * 24,
    30 * 24,
    90 * 24,
    180 * 24,
    365 * 24,
    ...(scenario.snapshotHours ?? []),
    scenario.endHour,
  ].filter(hour => hour >= 0 && hour <= scenario.endHour))

  const snapshots: LifeCourseSnapshot[] = [snapshot(state)]
  let previousSleeping = isSleepHour(0)

  for (let hour = 1; hour <= scenario.endHour; hour += 1) {
    const capacity = developmentalCapacity(hour)
    const stage = developmentStage(hour)
    const rawStimuli = exposuresByHour.get(hour) ?? []
    const stimuli = rawStimuli
      .filter(stimulus => stimulus.npcId === scenario.npcId)
      .map(stimulus => scaleStimulusForDevelopment(stimulus, capacity))

    let interests = state.interests
    let skills = state.skills
    let projects = state.projects

    if (stimuli.length > 0) {
      interests = updateCreativeInterests({
        existing: interests,
        stimuli,
        disposition: scenario.disposition,
        atTick: hour,
      })

      // Learning is exposure-driven and strongly development-gated.
      for (const stimulus of stimuli) {
        for (const domain of stimulus.domains) {
          const interest = interests.find(entry => entry.domain === domain)
          const learning = capacity.socialLearning
            * capacity.motorAgency
            * (0.001 + (interest?.strength ?? 0) * 0.0025)
          skills = learnSkill(skills, domain, learning)
        }
      }

      // A person may absorb, imitate and learn long before being capable of
      // deliberately starting an authored project.
      if (capacity.creativeAgency >= 0.28 && capacity.symbolicThought >= 0.35) {
        for (const interest of interests) {
          if (projects.some(project => project.domain === interest.domain && project.stage !== 'finished' && project.stage !== 'abandoned')) continue
          const seed = createCreativeSeed({
            npcId: scenario.npcId,
            domain: interest.domain,
            interest,
            stimuli,
            disposition: {
              ...scenario.disposition,
              creativity: scenario.disposition.creativity * capacity.creativeAgency,
              openness: scenario.disposition.openness * capacity.symbolicThought,
            },
            skills,
            atTick: hour,
          })
          if (seed) projects = [...projects, startCreativeProject(seed)]
        }
      }
    }

    const sleeping = isSleepHour(hour)
    const sleepCycles = state.sleepCycles + (!previousSleeping && sleeping ? 1 : 0)
    previousSleeping = sleeping

    state = {
      ...state,
      ageHours: hour,
      stage,
      capacity,
      interests,
      skills,
      projects,
      exposureCount: state.exposureCount + stimuli.length,
      sleepCycles,
    }

    if (requested.has(hour)) snapshots.push(snapshot(state))
  }

  return snapshots
}
