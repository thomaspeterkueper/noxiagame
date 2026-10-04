import type { PopulationActionIntent } from './actionIntent'
import { startSocialVisit } from './socialVisit'
import { createPersonActionRequest } from './personActionRequest'

type SupabaseLike = any

export type PopulationIntentExecutionResult =
  | { executed: true; kind: 'social_visit'; detail: Awaited<ReturnType<typeof startSocialVisit>> }
  | { executed: true; kind: 'person_action_request'; detail: Awaited<ReturnType<typeof createPersonActionRequest>> }
  | { executed: false; kind: PopulationActionIntent['kind']; reason: 'not_executed_here' | 'missing_social_target' }

/**
 * Executes only intents owned by the living-person action layer.
 *
 * Travel/work remain owned by their dedicated authoritative domain adapters.
 * This executor must never emulate those mutations locally.
 */
export async function executePopulationActionIntent(
  supabase: SupabaseLike,
  intent: PopulationActionIntent,
  tick: number,
): Promise<PopulationIntentExecutionResult> {
  if (intent.kind === 'local' && intent.action === 'social_interaction') {
    if (!intent.relatedPersonId) {
      return { executed: false, kind: 'local', reason: 'missing_social_target' }
    }
    const detail = await startSocialVisit(supabase, intent.personId, intent.relatedPersonId, tick)
    return { executed: detail.ok, kind: 'social_visit', detail } as PopulationIntentExecutionResult
  }

  if (intent.kind === 'acquire_tool') {
    const detail = await createPersonActionRequest(supabase, {
      kind: 'tool',
      personId: intent.personId,
      toolType: intent.toolType,
      purpose: intent.purpose,
      sourceActionCode: 'acquire_tool',
    }, tick)
    return { executed: detail.ok, kind: 'person_action_request', detail }
  }

  if (intent.kind === 'gain_capability') {
    const detail = await createPersonActionRequest(supabase, {
      kind: 'capability',
      personId: intent.personId,
      capability: intent.capability,
      minLevel: intent.minLevel,
      purpose: intent.purpose,
      sourceActionCode: 'gain_capability',
    }, tick)
    return { executed: detail.ok, kind: 'person_action_request', detail }
  }

  if (intent.kind === 'secure_resource') {
    const detail = await createPersonActionRequest(supabase, {
      kind: 'resource',
      personId: intent.personId,
      resource: intent.resource,
      amount: intent.amount,
      purpose: intent.purpose,
      sourceActionCode: 'secure_resource',
    }, tick)
    return { executed: detail.ok, kind: 'person_action_request', detail }
  }

  return { executed: false, kind: intent.kind, reason: 'not_executed_here' }
}
