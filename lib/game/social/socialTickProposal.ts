/** #551: controlled, side-effect-free boundary from authoritative tick data to NPC intentions.
 * The caller must use real server-owned venue snapshots. This function NEVER
 * issues movement, groups, database writes, or access decisions.
 */
import { reconsiderNpcPlan, type NpcIntention, type EncounterSignal, type PlanDecision } from './npcIntentions'
import { contextualSocialPreferences, type ApprovedSocialTendencies, type SocialContext } from './personalityVenueAdapter'
import type { NpcPreference, VenueOption } from './venueChoice'

export type NpcSocialTickInput = Readonly<{
  actor: NpcPreference
  approvedTraits?: ApprovedSocialTendencies | null
  socialContext: SocialContext
  venues: readonly VenueOption[]
  current: NpcIntention | null
  encounter?: EncounterSignal
  tickTime: number
  enabled: boolean
}>

export type NpcSocialTickResult = Readonly<{
  proposal: PlanDecision
  requiresCoreValidation: true
  source: 'npc_social_tick_proposal'
}>

/** Feature-flagged evaluation with safe fallback for legacy simulation. */
export function evaluateNpcSocialTick(input: NpcSocialTickInput): NpcSocialTickResult {
  if (!input.enabled) return {
    proposal: { action: input.current ? 'keep' : 'wait', next: input.current, reason: 'feature_disabled' },
    requiresCoreValidation: true, source: 'npc_social_tick_proposal',
  }
  const actor = contextualSocialPreferences(input.actor, input.approvedTraits ?? null, input.socialContext)
  return {
    proposal: reconsiderNpcPlan({
      actor, venues: input.venues, current: input.current,
      encounter: input.encounter, now: input.tickTime,
    }),
    requiresCoreValidation: true,
    source: 'npc_social_tick_proposal',
  }
}
