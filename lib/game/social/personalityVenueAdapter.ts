/**
 * #551: approved abstract personality tendencies -> group activity modifiers.
 * No access to Cultural DNA source material. The Core remains authoritative.
 * These traits are optional; legacy NPCs are unchanged.
 */
import type { NpcPreference, VisitPurpose } from './venueChoice'

export interface ApprovedSocialTendencies {
  curiosity: number
  sociability: number
  caution: number
  cooperation: number
}
export interface SocialContext {
  unfamiliar: boolean
  perceivedRisk: number
  trustedCompanion: boolean
}
const valid = (v: number) => Number.isFinite(v) && v >= 0 && v <= 1
const clamp = (v: number) => Math.max(0, Math.min(1, v))
/**
 * Produces an adjusted proposal, not a decision or persisted mutation.
 * In particular no personality trait can grant access, cause teleportation,
 * imply consent, or independently create a world event.
 */
export function contextualSocialPreferences(
  preference: NpcPreference,
  traits: ApprovedSocialTendencies | null,
  context: SocialContext,
): NpcPreference {
  if (!traits) return preference
  if (![traits.curiosity, traits.sociability, traits.caution, traits.cooperation,
    context.perceivedRisk].every(valid)) throw new Error('invalid_social_personality_context')
  const risk = context.perceivedRisk * (context.unfamiliar ? 1 : 0.5)
  const exploration = traits.curiosity * (context.unfamiliar ? 0.18 : 0.06)
  const social = traits.sociability * 0.14 + (context.trustedCompanion ? traits.cooperation * 0.08 : 0)
  const caution = traits.caution * risk * 0.22
  const interests: Partial<Record<VisitPurpose, number>> = { ...preference.interests }
  for (const purpose of ['socialize', 'music', 'dance', 'learn'] as const) {
    interests[purpose] = clamp((interests[purpose] ?? 0) + social + exploration - caution)
  }
  return { ...preference, interests }
}
