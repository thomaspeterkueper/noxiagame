import type { NpcMemory } from './npcRelationalMemory'

export const CREATIVE_DOMAINS = [
  'music',
  'visual_art',
  'writing',
  'architecture',
  'invention',
  'theory',
] as const

export type CreativeDomain = typeof CREATIVE_DOMAINS[number]

export interface CreativeDisposition {
  creativity: number
  openness: number
  persistence: number
  sensitivity: number
  routineTolerance: number
}

export interface CreativeSkillProfile {
  music?: number
  visual_art?: number
  writing?: number
  architecture?: number
  invention?: number
  theory?: number
}

export interface CreativeStimulus {
  id: string
  npcId: string
  memoryId: string
  traceId: string
  domains: CreativeDomain[]
  motifs: string[]
  emotionalWeight: number
  novelty: number
  salience: number
  atTick: number
}

export interface CreativeInterest {
  domain: CreativeDomain
  strength: number
  exposureCount: number
  voluntaryPull: number
  lastChangedTick: number
}

export interface CreativeSeed {
  id: string
  npcId: string
  domain: CreativeDomain
  motifs: string[]
  sourceMemoryIds: string[]
  sourceTraceIds: string[]
  tension: number
  novelty: number
  skillAtBirth: number
  createdAtTick: number
}

export type CreativeProjectStage = 'idea' | 'sketch' | 'draft' | 'revision' | 'finished' | 'abandoned'

export interface CreativeProject {
  id: string
  npcId: string
  domain: CreativeDomain
  seedId: string
  stage: CreativeProjectStage
  progress: number
  quality: number
  originality: number
  hoursInvested: number
  createdAtTick: number
  updatedAtTick: number
}

export interface CreativeIdentity {
  domain: CreativeDomain
  identityStrength: number
  practiceHours: number
  finishedWorks: number
  recognizedWorks: number
  professional: boolean
}

const unit = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0

function stableHash01(value: string): number {
  let h = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 100000) / 100000
}

function domainSkill(skills: CreativeSkillProfile, domain: CreativeDomain): number {
  return unit(skills[domain] ?? 0)
}

export function normalizeDisposition(input: Partial<CreativeDisposition>): CreativeDisposition {
  return {
    creativity: unit(input.creativity ?? 0.5),
    openness: unit(input.openness ?? 0.5),
    persistence: unit(input.persistence ?? 0.5),
    sensitivity: unit(input.sensitivity ?? 0.5),
    routineTolerance: unit(input.routineTolerance ?? 0.5),
  }
}

/**
 * Turns an existing subjective NPC memory into creative material.
 *
 * The caller supplies the semantic reading (domains/motifs). The function never
 * reads canonical world state and keeps the original memory/trace provenance.
 */
export function stimulusFromMemory<T>(input: {
  memory: NpcMemory<T>
  domains: CreativeDomain[]
  motifs: string[]
  emotionalWeight?: number
  novelty?: number
  atTick: number
}): CreativeStimulus {
  const { memory } = input
  if (memory.state === 'forgotten') {
    throw new Error('Forgotten memories cannot become conscious creative stimuli')
  }

  const domains = [...new Set(input.domains)].filter(domain => CREATIVE_DOMAINS.includes(domain))
  if (domains.length === 0) throw new Error('Creative stimulus needs at least one domain')

  const motifs = [...new Set(input.motifs.map(value => value.trim()).filter(Boolean))].slice(0, 12)
  if (motifs.length === 0) throw new Error('Creative stimulus needs at least one motif')

  return {
    id: `creative-stimulus:${memory.npcId}:${memory.id}:${input.atTick}`,
    npcId: memory.npcId,
    memoryId: memory.id,
    traceId: memory.traceId,
    domains,
    motifs,
    emotionalWeight: unit(input.emotionalWeight ?? memory.salience),
    novelty: unit(input.novelty ?? stableHash01(memory.id + ':' + motifs.join('|'))),
    salience: unit(memory.salience),
    atTick: input.atTick,
  }
}

export function updateCreativeInterests(input: {
  existing?: CreativeInterest[]
  stimuli: CreativeStimulus[]
  disposition: CreativeDisposition
  atTick: number
}): CreativeInterest[] {
  const disposition = normalizeDisposition(input.disposition)
  const previous = new Map((input.existing ?? []).map(entry => [entry.domain, entry]))

  return CREATIVE_DOMAINS.map(domain => {
    const old = previous.get(domain) ?? {
      domain,
      strength: 0,
      exposureCount: 0,
      voluntaryPull: 0,
      lastChangedTick: input.atTick,
    }

    const relevant = input.stimuli.filter(stimulus => stimulus.domains.includes(domain))
    if (relevant.length === 0) {
      return {
        ...old,
        strength: unit(old.strength * 0.995),
        voluntaryPull: unit(old.voluntaryPull * 0.997),
      }
    }

    const exposure = relevant.reduce((sum, stimulus) => {
      const felt = stimulus.salience * 0.35
        + stimulus.emotionalWeight * disposition.sensitivity * 0.35
        + stimulus.novelty * disposition.openness * 0.30
      return sum + felt
    }, 0) / relevant.length

    const gain = exposure * (0.35 + disposition.creativity * 0.35 + disposition.openness * 0.30)
    const strength = unit(old.strength + gain * 0.18)
    const voluntaryPull = unit(old.voluntaryPull + Math.max(0, strength - 0.25) * (0.04 + disposition.creativity * 0.08))

    return {
      domain,
      strength,
      exposureCount: old.exposureCount + relevant.length,
      voluntaryPull,
      lastChangedTick: input.atTick,
    }
  })
}

export function createCreativeSeed(input: {
  npcId: string
  domain: CreativeDomain
  interest: CreativeInterest
  stimuli: CreativeStimulus[]
  disposition: CreativeDisposition
  skills?: CreativeSkillProfile
  atTick: number
}): CreativeSeed | null {
  const disposition = normalizeDisposition(input.disposition)
  const relevant = input.stimuli
    .filter(stimulus => stimulus.npcId === input.npcId && stimulus.domains.includes(input.domain))
    .sort((a, b) => {
      const scoreA = a.salience * 0.4 + a.emotionalWeight * 0.35 + a.novelty * 0.25
      const scoreB = b.salience * 0.4 + b.emotionalWeight * 0.35 + b.novelty * 0.25
      return scoreB - scoreA || a.id.localeCompare(b.id)
    })

  const readiness = unit(
    input.interest.strength * 0.42
      + input.interest.voluntaryPull * 0.22
      + disposition.creativity * 0.21
      + disposition.openness * 0.15,
  )

  if (readiness < 0.46 || relevant.length === 0) return null

  const sourceCount = readiness > 0.72 && relevant.length > 1 ? 2 : 1
  const sources = relevant.slice(0, sourceCount)
  const motifs = [...new Set(sources.flatMap(source => source.motifs))].slice(0, 8)
  const averageNovelty = sources.reduce((sum, source) => sum + source.novelty, 0) / sources.length
  const emotionalTension = sources.reduce((sum, source) => sum + source.emotionalWeight, 0) / sources.length
  const recombinationBonus = sourceCount > 1 ? 0.12 * disposition.creativity : 0

  return {
    id: `creative-seed:${input.npcId}:${input.domain}:${input.atTick}:${sources.map(source => source.memoryId).join('+')}`,
    npcId: input.npcId,
    domain: input.domain,
    motifs,
    sourceMemoryIds: sources.map(source => source.memoryId),
    sourceTraceIds: sources.map(source => source.traceId),
    tension: unit(emotionalTension * (0.5 + disposition.sensitivity * 0.5)),
    novelty: unit(averageNovelty * 0.65 + disposition.creativity * 0.23 + recombinationBonus),
    skillAtBirth: domainSkill(input.skills ?? {}, input.domain),
    createdAtTick: input.atTick,
  }
}

export function startCreativeProject(seed: CreativeSeed): CreativeProject {
  return {
    id: `creative-project:${seed.id}`,
    npcId: seed.npcId,
    domain: seed.domain,
    seedId: seed.id,
    stage: 'idea',
    progress: 0,
    quality: unit(seed.skillAtBirth * 0.55 + seed.tension * 0.20 + seed.novelty * 0.25),
    originality: seed.novelty,
    hoursInvested: 0,
    createdAtTick: seed.createdAtTick,
    updatedAtTick: seed.createdAtTick,
  }
}

export function advanceCreativeProject(input: {
  project: CreativeProject
  disposition: CreativeDisposition
  skill: number
  availableHours: number
  atTick: number
}): CreativeProject {
  if (input.project.stage === 'finished' || input.project.stage === 'abandoned') return input.project

  const disposition = normalizeDisposition(input.disposition)
  const hours = Math.max(0, input.availableHours)
  if (hours === 0) return input.project

  const skill = unit(input.skill)
  const focus = unit(disposition.persistence * 0.62 + (1 - disposition.routineTolerance) * 0.10 + disposition.creativity * 0.28)
  const progressGain = hours * (0.055 + focus * 0.085)
  const nextProgress = Math.max(0, input.project.progress + progressGain)

  const stages: Array<{ until: number; stage: CreativeProjectStage }> = [
    { until: 0.22, stage: 'idea' },
    { until: 0.48, stage: 'sketch' },
    { until: 0.74, stage: 'draft' },
    { until: 1.0, stage: 'revision' },
  ]

  const stage = nextProgress >= 1
    ? 'finished'
    : (stages.find(entry => nextProgress < entry.until)?.stage ?? 'revision')

  const qualityGain = Math.min(0.18, hours * 0.012) * (skill * 0.55 + disposition.persistence * 0.30 + disposition.sensitivity * 0.15)
  const originalityDrift = Math.min(0.08, hours * 0.006) * disposition.creativity * (1 - skill * 0.25)

  return {
    ...input.project,
    stage,
    progress: Math.min(1, nextProgress),
    quality: unit(input.project.quality + qualityGain),
    originality: unit(input.project.originality + originalityDrift),
    hoursInvested: input.project.hoursInvested + hours,
    updatedAtTick: input.atTick,
  }
}

export function deriveCreativeIdentity(input: {
  domain: CreativeDomain
  practiceHours: number
  finishedWorks: number
  recognizedWorks?: number
  interestStrength: number
  skill: number
}): CreativeIdentity {
  const practiceHours = Math.max(0, input.practiceHours)
  const finishedWorks = Math.max(0, Math.floor(input.finishedWorks))
  const recognizedWorks = Math.max(0, Math.floor(input.recognizedWorks ?? 0))
  const practice = unit(practiceHours / 500)
  const portfolio = unit(finishedWorks / 12)
  const recognition = unit(recognizedWorks / 6)
  const identityStrength = unit(
    unit(input.interestStrength) * 0.30
      + unit(input.skill) * 0.25
      + practice * 0.20
      + portfolio * 0.15
      + recognition * 0.10,
  )

  return {
    domain: input.domain,
    identityStrength,
    practiceHours,
    finishedWorks,
    recognizedWorks,
    professional: identityStrength >= 0.72 && finishedWorks >= 3 && (recognizedWorks >= 1 || practiceHours >= 250),
  }
}
