import type { DreamActionIntent } from './dreamActionIntent'
import type { PopulationActionIntent } from '../population/actionIntent'

/**
 * Read-only compatibility bridge. Dream questions are NOT factual knowledge.
 * Research remains a proposal for the canonical research scheduler, not a
 * generic population action that could bypass evidence requirements.
 */
export type DreamPopulationBridge =
  | Readonly<{ ok: true; intent: PopulationActionIntent; dreamIntentId: string; epistemicStatus: 'unverified' }>
  | Readonly<{ ok: false; reason: 'unsupported' | 'no-social-target' | 'identity-mismatch' }>

export function bridgeDreamIntentToPopulation(input: {
  dreamIntent: DreamActionIntent
  personId: string
  relatedPersonId: string | null
}): DreamPopulationBridge {
  if (input.dreamIntent.npcId !== input.personId) return { ok: false, reason: 'identity-mismatch' }
  if (input.dreamIntent.kind !== 'social-conversation') return { ok: false, reason: 'unsupported' }
  if (!input.relatedPersonId || input.relatedPersonId === input.personId) return { ok: false, reason: 'no-social-target' }
  return Object.freeze({
    ok: true as const,
    dreamIntentId: input.dreamIntent.id,
    epistemicStatus: 'unverified' as const,
    intent: {
      kind: 'local' as const,
      personId: input.personId,
      action: 'social_interaction' as const,
      subjectRef: null,
      relatedPersonId: input.relatedPersonId,
    },
  })
}
