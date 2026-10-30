/**
 * #551 Agent-owned goals and interruption proposals.
 * Side-effect free. Core alone validates navigation, consent, action and memory.
 */
import { chooseGroupVenue, type NpcPreference, type VenueOption, type VenueChoice } from './venueChoice'

export type NpcIntention = Readonly<{
  npcId: string
  venueId: string
  reason: 'personal_need' | 'social_invitation' | 'spontaneous_encounter'
  createdAt: number
  lockedUntil: number
}>
export type EncounterSignal = Readonly<{
  counterpartId: string
  familiarity: number // 0..1: observed relationship
  invitationAccepted: boolean // upstream verified explicit consent
  urgentSafetyEvent: boolean
}>
export type PlanDecision = Readonly<{
  action: 'keep' | 'propose' | 'switch' | 'wait'
  next: NpcIntention | null
  reason: string
  alternative?: VenueChoice
}>
const bounded = (n: number) => Number.isFinite(n) && n >= 0 && n <= 1
/**
 * A candidate plan is a proposal, never a movement command.
 * No coercion: an encounter alone cannot commit a group invitation.
 * Cooldown prevents constant oscillation between similar venues.
 */
export function reconsiderNpcPlan(input: {
  actor: NpcPreference
  venues: readonly VenueOption[]
  current: NpcIntention | null
  encounter?: EncounterSignal
  now: number
  minDesirability?: number
}): PlanDecision {
  const { actor, venues, current, encounter, now } = input
  if (!Number.isFinite(now) || !actor.npcId.trim() ||
    (current && (current.npcId !== actor.npcId || now < current.createdAt)) ||
    (encounter && (!bounded(encounter.familiarity) || !encounter.counterpartId.trim())))
    return { action: 'wait', next: current, reason: 'invalid_context' }
  if (encounter?.urgentSafetyEvent) return {
    action: 'wait', next: current, reason: 'safety_event_requires_core_response',
  }
  if (current && now < current.lockedUntil)
    return { action: 'keep', next: current, reason: 'commitment_cooldown' }
  const choice = chooseGroupVenue([actor], venues, input.minDesirability)
  if (!choice) return { action: current ? 'keep' : 'wait', next: current, reason: 'no_eligible_venue' }
  if (current?.venueId === choice.venueId)
    return { action: 'keep', next: current, reason: 'already_preferred' }
  // If another NPC invites the actor, treat it as a candidate only after acceptance.
  // A separate group negotiation still needs to commit that plan.
  const social = !!encounter?.invitationAccepted && encounter.familiarity >= 0.2
  const next: NpcIntention = {
    npcId: actor.npcId,
    venueId: choice.venueId,
    reason: social ? 'spontaneous_encounter' : 'personal_need',
    createdAt: now,
    lockedUntil: now + 120,
  }
  return {
    action: current ? 'switch' : 'propose',
    next,
    reason: social ? 'accepted_social_opportunity' : 'individual_motivation',
    alternative: choice,
  }
}
