import { synthesizeNpcDream, type DreamMemory, type DreamSource, type DreamEpisode } from './dreamKnowledge'
import { proposeDreamInquiry, type DreamInquiry } from './dreamInquiry'
import { decideDreamInquiry, type DreamInquiryDecision } from './dreamInquiryDecision'
import { planDreamAction, type DreamActionIntent } from './dreamActionIntent'
import { admitDreamAction, type DreamActionAdmission } from './dreamActionAdmission'

export type DreamCyclePreview = Readonly<{
  dream: DreamEpisode | null
  inquiry: DreamInquiry | null
  decision: DreamInquiryDecision | null
  intent: DreamActionIntent | null
  admission: DreamActionAdmission | null
}>

/**
 * Complete dry-run pipeline, never a live tick hook.
 * The feature flag defaults off, and all admission checks must be supplied by
 * the canonical NPC scheduler before any eventual execution.
 */
export function previewDreamCycle(input: {
  npcId: string
  sleepTick: number
  wakeTick: number
  worldYear: number
  sleepingAtSleepTick: boolean
  awakeAtWakeTick: boolean
  memories: readonly DreamMemory[]
  cachedSources: readonly DreamSource[]
  curiosity: number
  socialTrust: number
  emotionalSensitivity: number
  energy: number
  working: boolean
  traveling: boolean
  hasActiveTask: boolean
  essentialNeedsPending: boolean
  knownIntentIds: readonly string[]
  alreadyScheduledInWindow: number
  availableSlots: number
  featureEnabled?: boolean
}): DreamCyclePreview {
  const empty: DreamCyclePreview = Object.freeze({ dream: null, inquiry: null, decision: null, intent: null, admission: null })
  if (!input.featureEnabled) return empty
  if (!Number.isSafeInteger(input.wakeTick) || input.wakeTick <= input.sleepTick) throw new Error('Wake must follow sleep')
  const dream = synthesizeNpcDream({
    npcId: input.npcId, tick: input.sleepTick, worldYear: input.worldYear,
    sleeping: input.sleepingAtSleepTick, memories: input.memories,
    sources: input.cachedSources, emotionalSensitivity: input.emotionalSensitivity,
  })
  if (!dream) return empty
  const inquiry = proposeDreamInquiry({ dream, awake: input.awakeAtWakeTick,
    atTick: input.wakeTick, curiosity: input.curiosity })
  if (!inquiry) return Object.freeze({ ...empty, dream })
  const decision = decideDreamInquiry({ inquiry, atTick: input.wakeTick,
    curiosity: input.curiosity, socialTrust: input.socialTrust,
    distress: dream.distressScore, energy: input.energy })
  const intent = planDreamAction({ inquiry, decision, atTick: input.wakeTick,
    featureEnabled: true, alreadyScheduledInWindow: input.alreadyScheduledInWindow })
  if (!intent) return Object.freeze({ ...empty, dream, inquiry, decision })
  const admission = admitDreamAction({ intent, featureEnabled: true,
    awake: input.awakeAtWakeTick, working: input.working,
    traveling: input.traveling, hasActiveTask: input.hasActiveTask,
    essentialNeedsPending: input.essentialNeedsPending,
    knownIntentIds: input.knownIntentIds, availableSlots: input.availableSlots })
  return Object.freeze({ dream, inquiry, decision, intent, admission })
}
