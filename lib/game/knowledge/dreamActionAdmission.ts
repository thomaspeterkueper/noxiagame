import type { DreamActionIntent } from './dreamActionIntent'

/**
 * Safe hand-off into NPC scheduling: dreams never preempt work, sleep,
 * essential needs, travel, or an already active task.
 * This is an admission gate, not a scheduler or executor.
 */
export type DreamActionAdmission = Readonly<{
  accepted: boolean
  reason: 'accepted' | 'disabled' | 'busy' | 'needs' | 'unavailable' | 'duplicate' | 'capacity'
  intent: DreamActionIntent | null
}>

export function admitDreamAction(input: {
  intent: DreamActionIntent
  featureEnabled: boolean
  awake: boolean
  working: boolean
  traveling: boolean
  hasActiveTask: boolean
  essentialNeedsPending: boolean
  knownIntentIds: readonly string[]
  availableSlots: number
}): DreamActionAdmission {
  const reject = (reason: DreamActionAdmission['reason']): DreamActionAdmission =>
    Object.freeze({ accepted: false, reason, intent: null })
  if (!Number.isSafeInteger(input.availableSlots) || input.availableSlots < 0) throw new Error('Invalid slots')
  if (!input.featureEnabled) return reject('disabled')
  if (!input.awake || input.traveling) return reject('unavailable')
  if (input.working || input.hasActiveTask) return reject('busy')
  if (input.essentialNeedsPending) return reject('needs')
  if (input.knownIntentIds.includes(input.intent.id)) return reject('duplicate')
  if (input.availableSlots === 0) return reject('capacity')
  if (input.intent.epistemicStatus !== 'unverified') throw new Error('Dream intent must remain unverified')
  return Object.freeze({ accepted: true, reason: 'accepted' as const, intent: input.intent })
}
