// lib/game/observation/types.ts
// Erstellt:     21.08.2026
// Version:      0.1.1
//
// Typen und Konstanten des NOXIA Game-Observation-Producers v0.1.
// Umsetzung des Protokolls „Game Observation → Task Candidate“ aus
// kueper-ecosystem/docs/architecture/GAME_OBSERVATION_TASK_PROTOCOL.md.
//
// Grenze:
//   Game Action -> Observation -> Evidence -> TaskCandidate -> Gate -> Ecosystem Request
//
// Eine Game Action darf NIE direkt einen Implementierungs-Task erzeugen.
// Kein Schreiben nach GitHub/Supabase aus Gameplay-Code — einzige Grenze sind
// lokale `.kueper/outbox`-Envelopes, die von der Ecosystem-Schleife geroutet werden.
//
// Alles hier ist pur und deterministisch: kein Math.random, kein Date.now,
// kein IO. Zeit wird als Parameter übergeben.
// ─────────────────────────────────────────────────────────────────────────────

export const OBSERVATION_KINDS = [
  'BUG',
  'DEAD_END',
  'BALANCE_ANOMALY',
  'UX_FRICTION',
  'SCIENCE_GAP',
  'KNOWLEDGE_GAP',
  'CONTENT_GAP',
  'RESOURCE_UNUSED',
  'AI_BEHAVIOR',
  'PROPOSAL',
] as const

export type ObservationKind = (typeof OBSERVATION_KINDS)[number]

export interface GateConfig {
  auto_promotable_kinds: ObservationKind[]
  parked_kinds: ObservationKind[]
  min_confidence: number
  min_reproduction_steps: number
  max_candidates_per_world: number
  max_evidence_refs: number
  default_target: string
  default_depth: number
  source: string
}

export const DEFAULT_GATE_CONFIG: GateConfig = {
  auto_promotable_kinds: ['BUG', 'DEAD_END'],
  parked_kinds: ['PROPOSAL'],
  min_confidence: 0.9,
  min_reproduction_steps: 1,
  max_candidates_per_world: 5,
  max_evidence_refs: 20,
  default_target: 'NOXIA',
  default_depth: 1,
  source: 'NOXIA',
}

// KUEPER-Ecosystem-Registry-Muster für Ziel-Targets
// (kueper-ecosystem followup-request.schema.json): Nur Registry-Kennungen der
// Form ^[A-Z][A-Z0-9-]*$ — keine Pfade, keine Separatoren. Das Target landet
// unverändert im Outbox-Dateinamen und darf das `.kueper/outbox`-Verzeichnis
// nie verlassen können.
export const TARGET_PATTERN = /^[A-Z][A-Z0-9-]*$/

export function isValidTarget(target: string): boolean {
  return TARGET_PATTERN.test(target)
}

export const COST_POLICY_BY_KIND: Record<ObservationKind, string> = {
  BUG: 'immediate',
  DEAD_END: 'immediate',
  BALANCE_ANOMALY: 'prefer_off_peak',
  UX_FRICTION: 'prefer_off_peak',
  SCIENCE_GAP: 'prefer_off_peak',
  KNOWLEDGE_GAP: 'prefer_off_peak',
  CONTENT_GAP: 'prefer_off_peak',
  RESOURCE_UNUSED: 'prefer_off_peak',
  AI_BEHAVIOR: 'prefer_off_peak',
  PROPOSAL: 'off_peak_only',
}

export const PRIORITY_BY_KIND: Record<ObservationKind, 'low' | 'medium' | 'high' | 'critical'> = {
  BUG: 'medium',
  DEAD_END: 'high',
  BALANCE_ANOMALY: 'low',
  UX_FRICTION: 'low',
  SCIENCE_GAP: 'low',
  KNOWLEDGE_GAP: 'low',
  CONTENT_GAP: 'low',
  RESOURCE_UNUSED: 'low',
  AI_BEHAVIOR: 'low',
  PROPOSAL: 'low',
}

export interface EvidenceItem {
  ref: string
  kind?: string
  digest?: string
  note?: string
}

export interface Observation {
  observation_id?: string
  world_id: string
  agent_id: string
  kind: ObservationKind
  system: string
  summary: string
  evidence?: EvidenceItem[]
  reproduction?: string[]
  expected: string
  actual: string
  confidence: number
  observed_at?: string
  target?: string
}

export type FindingEvent = 'INITIAL' | 'REGRESSION'
export type FindingStatus = 'UNEMITTED' | 'OPEN' | 'RESOLVED'

export interface TaskCandidate {
  candidate_id: string
  source: string
  target: string
  type: ObservationKind
  finding_event: FindingEvent
  title: string
  reason: string
  requested_change: string
  expected_result: string
  evidence_refs: string[]
  occurrences: number
  confidence: number
  cost_policy: string
  estimated_effort: string
  world_id: string
  agent_id: string
  reproduction: string[]
  expected: string
  actual: string
  observed_at: string
}

export type GateStatus = 'approved' | 'aggregating' | 'parked' | 'suppressed'

export interface GateDecision {
  status: GateStatus
  reason: string
  fingerprint: string
  candidate: TaskCandidate | null
}

export interface OutboxEnvelope {
  target: string
  title: string
  reason: string
  requested_change: string
  expected_result: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  parent_task: string
  depth: number
  affects: string[]
  cost_policy: string
  estimated_effort: string
  protocol: 'GAME_OBSERVATION_TASK_PROTOCOL'
  protocol_version: 'v0.1'
  candidate_id: string
  type: ObservationKind
  finding_event: FindingEvent
  world_id: string
  agent_id: string
  occurrences: number
  confidence: number
  evidence_refs: string[]
  reproduction: string[]
  expected: string
  actual: string
  observed_at: string
}

export interface ObservationAggregate {
  fingerprint: string
  kind: ObservationKind
  system: string
  summary: string
  occurrences: number
  max_confidence: number
  worlds: string[]
  agents: string[]
  evidence_refs: string[]
  reproduction: string[]
  expected: string
  actual: string
  first_observed_at: string
  last_observed_at: string
  emissions: number
  last_emitted_at: string | null
  finding_status: FindingStatus
  resolved_at: string | null
  regressions: number
  parked: boolean
}
