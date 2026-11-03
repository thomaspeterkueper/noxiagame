import type { DreamInquiry } from './dreamInquiry'

export type DreamInquiryDecision = Readonly<{
  inquiryId: string
  npcId: string
  decidedAtTick: number
  action: 'defer' | 'ask-someone' | 'investigate' | 'dismiss'
  epistemicStatus: 'unverified'
  evidenceRequired: true
}>

/**
 * Deterministic, side-effect-free intention selection.
 * No conversation, job, fact mutation or API request is performed here.
 * Distress reduces investigation pressure rather than forcing a fearful NPC to act.
 */
export function decideDreamInquiry(input: {
  inquiry: DreamInquiry
  atTick: number
  curiosity: number
  socialTrust: number
  distress: number
  energy: number
}): DreamInquiryDecision {
  const { inquiry, atTick, curiosity, socialTrust, distress, energy } = input
  if (!Number.isSafeInteger(atTick) || atTick < inquiry.createdAtTick) throw new Error('Invalid decision tick')
  for (const [name, value] of Object.entries({ curiosity, socialTrust, distress, energy })) {
    if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error('Invalid ' + name)
  }
  if (inquiry.state !== 'unverified') throw new Error('Inquiry must be unverified')
  let action: DreamInquiryDecision['action'] = 'defer'
  if (energy < 0.2) action = 'defer'
  else if (distress >= 0.7) action = socialTrust >= 0.5 ? 'ask-someone' : 'defer'
  else if (curiosity >= 0.75 && energy >= 0.5) action = 'investigate'
  else if (socialTrust >= 0.65) action = 'ask-someone'
  else if (curiosity < 0.3) action = 'dismiss'
  return Object.freeze({
    inquiryId: inquiry.id,
    npcId: inquiry.npcId,
    decidedAtTick: atTick,
    action,
    epistemicStatus: 'unverified' as const,
    evidenceRequired: true as const,
  })
}
