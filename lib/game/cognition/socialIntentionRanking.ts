/** Pure bridge from remembered life events to feasible, ranked social intentions.
 * All availability and consent hints are advisory snapshots; Core revalidates actions.
 */
import type { SocialGoalSignal, SocialGoal } from './biographyGoalSignals'
export type SocialOpportunity = {
  relatedPersonId: string
  reachable: boolean
  contactAllowed: boolean
  relationshipCloseness: number
}
export type SocialNeeds = { energy: number; safety: number; socialConnection: number }
export type RankedSocialIntention = {
  goal: SocialGoal
  targetId: string
  score: number
  sourceEventId: string
  executable: false
}
const unit = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
export function rankBiographyIntentions(
  npcId: string, signals: readonly SocialGoalSignal[],
  opportunities: readonly SocialOpportunity[], needs: SocialNeeds,
): RankedSocialIntention[] {
  const byId = new Map(opportunities.map(o => [o.relatedPersonId, o]))
  return signals.filter(s => s.npcId === npcId).flatMap(signal => {
    const opp = byId.get(signal.relatedPersonId)
    if (!opp || !opp.reachable || !opp.contactAllowed) return []
    const closeness = unit(opp.relationshipCloseness)
    const safety = unit(needs.safety), energy = unit(needs.energy)
    const connection = unit(needs.socialConnection)
    const relationWeight = signal.goal === 'grieve' ? 0.25 + 0.75 * closeness
      : 0.4 + 0.6 * closeness
    const score = unit(signal.strength) * relationWeight *
      (0.5 + 0.5 * connection) * (1 - 0.65 * safety) * (0.4 + 0.6 * energy)
    if (score <= 0) return []
    return [{goal: signal.goal, targetId: signal.relatedPersonId, score,
      sourceEventId: signal.sourceEventId, executable: false as const}]
  }).sort((a,b) => b.score-a.score || a.sourceEventId.localeCompare(b.sourceEventId))
}
