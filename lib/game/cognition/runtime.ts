import type { PersonObservation } from '../population/observation'
import type { PersonKnowledge } from '../population/types'
import { assessDecisionSufficiency, type DecisionSufficiencyPolicy } from '../population/decisionSufficiency'

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

export interface Hypothesis {
  id: string
  groupId: string
  subjectRef: string
  claimType: string
  evidenceFor: string[]
  evidenceAgainst: string[]
  confidence: number
  status: 'proposed' | 'testing' | 'supported' | 'rejected' | 'inconclusive'
}

export interface ExperimentPlan {
  id: string
  hypothesisId: string
  intervention: Record<string, unknown>
  baseline: Record<string, unknown>
  durationTicks: number
  measurements: string[]
  status: 'planned' | 'running' | 'completed' | 'cancelled'
}

export interface TemporalProtocol {
  id: string
  version: number
  subjectRef: string
  phaseOffsetMinutes: number
  evidenceRefs: string[]
  supersedes?: string | null
}

export interface ProtocolRevision extends TemporalProtocol {
  supersedes: string
  approvedAtTick: number
  uncertainty: number
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

const unit = (n: number) => Math.max(0, Math.min(1, n))

export function classifyTrigger(input: Omit<CognitiveTrigger, 'recommendedTier'>): CognitiveTrigger {
  const novelty = unit(input.novelty)
  const uncertainty = unit(input.uncertainty)
  const importance = unit(input.importance)
  const urgency = unit(input.urgency)
  const score = novelty * 0.35 + uncertainty * 0.3 + importance * 0.25 + urgency * 0.1
  const recommendedTier: CognitiveTier = score >= 0.78 ? 'L4' : score >= 0.5 ? 'L2' : score >= 0.2 ? 'L1' : 'L0'
  return { ...input, novelty, uncertainty, importance, urgency, recommendedTier }
}

export function lightingObservation(event: WorldEvent, observerPersonId: string, measuredPhaseOffsetMinutes: number, confidence = 0.95): PersonObservation {
  return {
    id: 'obs:' + event.id + ':' + observerPersonId,
    observerPersonId,
    observedTick: event.occurredAtTick,
    subjectType: 'habitat_lighting',
    subjectRef: event.scopeRef,
    observationType: 'lighting_phase_measurement',
    sourceType: 'measurement',
    sourceRef: 'sensor:' + event.scopeRef + ':lighting',
    confidence,
    payload: { measuredPhaseOffsetMinutes },
    evidenceRefs: ['event:' + event.id],
  }
}

export function chronobiologyEvidencePolicy(subjectRef: string): DecisionSufficiencyPolicy {
  return {
    requirements: [{ subjectType: 'habitat_lighting', subjectRef, knowledgeType: 'lighting_phase_measurement', minConfidence: 0.7, maxAgeTicks: 24 }],
    minCoverage: 1,
    minAggregateConfidence: 0.7,
    risk: 'medium',
    reversible: true,
    escalationAvailable: true,
  }
}

export function assessChronobiologyKnowledge(knowledge: PersonKnowledge[], subjectRef: string, atTick: number) {
  return assessDecisionSufficiency({ knowledge, atTick, policy: chronobiologyEvidencePolicy(subjectRef) })
}

export function planTemporalResponse(observation: PersonObservation, knownProtocol: TemporalProtocol) {
  const raw = Number(observation.payload.measuredPhaseOffsetMinutes ?? 0)
  const deviation = Math.abs(raw - knownProtocol.phaseOffsetMinutes)
  const trigger = classifyTrigger({
    subjectId: observation.observerPersonId,
    observationIds: [observation.id],
    novelty: unit(deviation / 180),
    uncertainty: unit(1 - observation.confidence),
    importance: unit(deviation / 120),
    urgency: unit(deviation / 240),
    reasonCodes: deviation > 60 ? ['TEMPORAL_PHASE_DEVIATION'] : [],
  })
  if (trigger.recommendedTier === 'L4') return { trigger, action: 'escalate' as const, escalation: createEscalation(trigger, observation.observedTick) }
  if (trigger.recommendedTier === 'L2') return { trigger, action: 'plan_experiment' as const }
  if (trigger.recommendedTier === 'L1') return { trigger, action: 'apply_known_protocol' as const }
  return { trigger, action: 'none' as const }
}

export function createChronobiologyExperiment(observation: PersonObservation, groupId: string): { hypothesis: Hypothesis; experiment: ExperimentPlan } {
  const hypothesis: Hypothesis = {
    id: 'hypothesis:' + observation.id,
    groupId,
    subjectRef: observation.subjectRef,
    claimType: 'lighting_phase_shift_affects_temporal_alignment',
    evidenceFor: observation.evidenceRefs,
    evidenceAgainst: [],
    confidence: unit(observation.confidence * 0.6),
    status: 'testing',
  }
  return {
    hypothesis,
    experiment: {
      id: 'experiment:' + observation.id,
      hypothesisId: hypothesis.id,
      intervention: { restorePhaseOffsetMinutes: 0 },
      baseline: { measuredPhaseOffsetMinutes: observation.payload.measuredPhaseOffsetMinutes },
      durationTicks: 12,
      measurements: ['lighting_phase_measurement', 'plant_activity_phase', 'crew_activity_phase'],
      status: 'planned',
    },
  }
}

export function reviseProtocol(input: { protocol: TemporalProtocol; experiment: ExperimentPlan; evidenceRefs: string[]; approvedAtTick: number; uncertainty: number }): ProtocolRevision {
  return {
    ...input.protocol,
    id: input.protocol.id,
    version: input.protocol.version + 1,
    evidenceRefs: [...input.protocol.evidenceRefs, ...input.evidenceRefs],
    supersedes: input.protocol.id + '@' + input.protocol.version,
    approvedAtTick: input.approvedAtTick,
    uncertainty: unit(input.uncertainty),
  }
}

function createEscalation(trigger: CognitiveTrigger, tick: number): EscalationRequest {
  return {
    id: 'escalation:' + trigger.observationIds.join(':'),
    subjectId: trigger.subjectId,
    tier: 'L4',
    observationIds: [...trigger.observationIds],
    reasonCodes: [...trigger.reasonCodes],
    createdAtTick: tick,
    status: 'pending',
  }
}
