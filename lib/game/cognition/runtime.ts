import type { PersonObservation } from '../population/observation'

export type CognitiveTier = 'L0' | 'L1' | 'L2' | 'L3' | 'L4'

export interface WorldEvent {
  id: string
  type: string
  occurredAtTick: number
  scopeRef: string
  sourceSystem: string
  payload: Record<string, unknown>
  causationId?: string | null
  correlationId?: string | null
}

export interface CognitiveTrigger {
  subjectId: string
  observationIds: string[]
  novelty: number
  uncertainty: number
  importance: number
  urgency: number
  reasonCodes: string[]
  recommendedTier: CognitiveTier
}

export interface EscalationRequest {
  id: string
  subjectId: string
  tier: 'L4'
  observationIds: string[]
  reasonCodes: string[]
  createdAtTick: number
  status: 'pending'
}

export interface TemporalProtocol {
  id: string
  version: number
  phaseOffsetMinutes: number
  evidenceRefs: string[]
  supersedes?: string | null
}

const unit = (n: number) => Math.max(0, Math.min(1, n))

export function classifyTrigger(input: Omit<CognitiveTrigger, 'recommendedTier'>): CognitiveTrigger {
  const novelty = unit(input.novelty)
  const uncertainty = unit(input.uncertainty)
  const importance = unit(input.importance)
  const urgency = unit(input.urgency)
  const score = novelty * 0.35 + uncertainty * 0.3 + importance * 0.25 + urgency * 0.1
  const recommendedTier: CognitiveTier =
    score >= 0.78 ? 'L4' :
    score >= 0.5 ? 'L2' :
    score >= 0.2 ? 'L1' : 'L0'
  return { ...input, novelty, uncertainty, importance, urgency, recommendedTier }
}

export function lightingObservation(
  event: WorldEvent,
  observerPersonId: string,
  measuredPhaseOffsetMinutes: number,
  confidence = 0.95,
): PersonObservation {
  return {
    id: `obs:${event.id}:${observerPersonId}`,
    observerPersonId,
    observedTick: event.occurredAtTick,
    subjectType: 'habitat_lighting',
    subjectRef: event.scopeRef,
    observationType: 'lighting_phase_offset',
    sourceType: 'measurement',
    sourceRef: `sensor:${event.scopeRef}:lighting`,
    confidence,
    payload: { measuredPhaseOffsetMinutes },
    evidenceRefs: [`event:${event.id}`],
  }
}

export function planTemporalResponse(
  observation: PersonObservation,
  knownProtocol: TemporalProtocol,
): { trigger: CognitiveTrigger; action: 'none' | 'apply_known_protocol' | 'plan_experiment' | 'escalate'; escalation?: EscalationRequest } {
  const raw = Number(observation.payload.measuredPhaseOffsetMinutes ?? 0)
  const deviation = Math.abs(raw - knownProtocol.phaseOffsetMinutes)
  const novelty = unit(deviation / 180)
  const uncertainty = unit(1 - observation.confidence)
  const importance = unit(deviation / 120)
  const urgency = unit(deviation / 240)
  const trigger = classifyTrigger({
    subjectId: observation.observerPersonId,
    observationIds: [observation.id],
    novelty,
    uncertainty,
    importance,
    urgency,
    reasonCodes: deviation > 60 ? ['TEMPORAL_PHASE_DEVIATION'] : [],
  })

  if (trigger.recommendedTier === 'L4') {
    return {
      trigger,
      action: 'escalate',
      escalation: {
        id: `escalation:${observation.id}`,
        subjectId: observation.observerPersonId,
        tier: 'L4',
        observationIds: [observation.id],
        reasonCodes: trigger.reasonCodes,
        createdAtTick: observation.observedTick,
        status: 'pending',
      },
    }
  }
  if (trigger.recommendedTier === 'L2') return { trigger, action: 'plan_experiment' }
  if (trigger.recommendedTier === 'L1') return { trigger, action: 'apply_known_protocol' }
  return { trigger, action: 'none' }
}
