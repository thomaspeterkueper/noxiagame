import type { DreamInquiry } from './dreamInquiry'
import type { DreamInquiryDecision } from './dreamInquiryDecision'

/**
 * An intent is not a completed action. Runtime schedulers may consume it
 * only after normal NPC availability, permission and resource checks.
 */
export type DreamActionIntent = Readonly<{
  id: string
  npcId: string
  inquiryId: string
  createdAtTick: number
  kind: 'social-conversation' | 'knowledge-investigation'
  prompt: string
  epistemicStatus: 'unverified'
  sourceIds: readonly string[]
}>

/**
 * Pure opt-in planner: at most one intention per NPC per sleep cycle.
 * Caller supplies the number of already accepted dream actions in the current
 * rolling window; no persistent scheduling or world mutation occurs here.
 */
export function planDreamAction(input: {
  inquiry: DreamInquiry
  decision: DreamInquiryDecision
  atTick: number
  featureEnabled: boolean
  alreadyScheduledInWindow: number
  maxActionsPerWindow?: number
}): DreamActionIntent | null {
  const { inquiry, decision, atTick } = input
  if (!Number.isSafeInteger(atTick) || atTick < decision.decidedAtTick) throw new Error('Invalid action tick')
  if (!Number.isSafeInteger(input.alreadyScheduledInWindow) || input.alreadyScheduledInWindow < 0) throw new Error('Invalid action count')
  const cap = input.maxActionsPerWindow ?? 1
  if (!Number.isSafeInteger(cap) || cap < 0 || cap > 10) throw new Error('Invalid action cap')
  if (!input.featureEnabled || input.alreadyScheduledInWindow >= cap) return null
  if (inquiry.id !== decision.inquiryId || inquiry.npcId !== decision.npcId) throw new Error('Inquiry decision mismatch')
  if (inquiry.state !== 'unverified' || decision.epistemicStatus !== 'unverified' || !decision.evidenceRequired) throw new Error('Unverified provenance required')
  const kind = decision.action === 'ask-someone' ? 'social-conversation' as const :
    decision.action === 'investigate' ? 'knowledge-investigation' as const : null
  if (!kind) return null
  return Object.freeze({
    id: 'dream-action:' + inquiry.id,
    npcId: inquiry.npcId,
    inquiryId: inquiry.id,
    createdAtTick: atTick,
    kind,
    prompt: inquiry.question.slice(0, 240),
    epistemicStatus: 'unverified' as const,
    sourceIds: Object.freeze([...inquiry.sourceIds]),
  })
}
