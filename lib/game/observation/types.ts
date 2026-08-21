// lib/game/observation/types.ts
// Erstellt:     21.08.2026
// Version:      0.1.0
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

// ── Observation-Kinds (Protokoll, initiale Liste) ────────────────────────────
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

// ── Gate-Konfiguration v0.1 ──────────────────────────────────────────────────
// BUG und DEAD_END dürfen nach EINEM hoch-konfidenten, reproduzierbaren
// Auftreten passieren. Alles andere wird in v0.1 nur aggregiert (spätere
// Versionen) bzw. geparkt (PROPOSAL — niemals autonom umsetzen).
export interface GateConfig {
  /** Kinds, die in v0.1 automatisch zum TaskCandidate aufsteigen dürfen. */
  auto_promotable_kinds: ObservationKind[]
  /** Kinds, die immer geparkt werden (kein autonomer Implementierungs-Task). */
  parked_kinds: ObservationKind[]
  /** Mindest-Konfidenz (0..1) für Einzel-Auftreten-Promotion. */
  min_confidence: number
  /** Mindestanzahl Reproduktionsschritte, sonst gilt die Beobachtung als nicht reproduzierbar. */
  min_reproduction_steps: number
  /** Cooldown pro Fingerprint zwischen zwei Emissionen (ms). */
  cooldown_ms: number
  /** Obergrenze emittierter Kandidaten pro Welt (bounded emissions). */
  max_candidates_per_world: number
  /** Obergrenze aggregierter Evidence-Refs je Kandidat (bounded provenance). */
  max_evidence_refs: number
  /** Standard-Ziel-Repo-Code, wenn die Beobachtung kein Ziel vorschlägt. */
  default_target: string
  /** Routing-Tiefe neuer Envelopes. */
  default_depth: number
  /** Quelle (Repo-Code) des Producers. */
  source: string
}

export const DEFAULT_GATE_CONFIG: GateConfig = {
  auto_promotable_kinds: ['BUG', 'DEAD_END'],
  parked_kinds: ['PROPOSAL'],
  min_confidence: 0.9,
  min_reproduction_steps: 1,
  cooldown_ms: 6 * 60 * 60 * 1000,   // 6 h pro Fingerprint
  max_candidates_per_world: 5,
  max_evidence_refs: 20,
  default_target: 'NOXIA',
  default_depth: 1,
  source: 'NOXIA',
}

// ── Kosten-/Prioritäts-Mapping (Protokoll: „Cost policy“) ────────────────────
// Reproduzierbare, blockierende BUG/DEAD_END → immediate; alles andere (das in
// v0.1 ohnehin nicht emittiert wird) → prefer_off_peak.
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
  PROPOSAL: 'off_peak_only',          // nie autonom — wird geparkt
}

export const PRIORITY_BY_KIND: Record<ObservationKind, 'low' | 'medium' | 'high' | 'critical'> = {
  BUG: 'medium',
  DEAD_END: 'high',                   // blockiert Progression
  BALANCE_ANOMALY: 'low',
  UX_FRICTION: 'low',
  SCIENCE_GAP: 'low',
  KNOWLEDGE_GAP: 'low',
  CONTENT_GAP: 'low',
  RESOURCE_UNUSED: 'low',
  AI_BEHAVIOR: 'low',
  PROPOSAL: 'low',
}

// ── Evidence ─────────────────────────────────────────────────────────────────
// Evidence bleibt unabhängig von generierter Prosa erhalten (Protokoll:
// „evidence retained independently of generated prose“). Ein Ref ist ein
// stabiler Verweis (Zustands-Digest, Log-Referenz, Welt/Tick) — keine
// Inhaltskopie, damit der Sink klein bleibt.
export interface EvidenceItem {
  ref: string
  kind?: string        // z. B. 'state' | 'log' | 'data'
  digest?: string      // Hash des Beleginhalts (Provenienz ohne Inhalt)
  note?: string
}

// ── Observation (Protokoll-Envelope, NOXIA-seitig erweitert) ─────────────────
export interface Observation {
  /** Stabil vergebene ID; Default: `<fingerprint>-<laufende Nummer>`. */
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
  /** 0..1 */
  confidence: number
  /** RFC3339; Default wird vom Sink aus dem übergebenen now gestempelt. */
  observed_at?: string
  /** Vorgeschlagenes Ziel (Repo-Code). Das Gate/Routing validiert die Ownership. */
  target?: string
}

// ── TaskCandidate (Protokoll-Schema) ─────────────────────────────────────────
export interface TaskCandidate {
  /** Stabiler Fingerprint der zugrunde liegenden Bedingung. */
  candidate_id: string
  source: string
  target: string
  type: ObservationKind
  title: string
  reason: string
  requested_change: string
  expected_result: string
  evidence_refs: string[]
  occurrences: number
  confidence: number
  cost_policy: string
  estimated_effort: string
  // Provenienz (Protokoll: world/agent/evidence bleibt an jedem Request erhalten)
  world_id: string
  agent_id: string
  reproduction: string[]
  expected: string
  actual: string
  observed_at: string
}

// ── Gate-Entscheidung ────────────────────────────────────────────────────────
export type GateStatus = 'approved' | 'aggregating' | 'parked' | 'suppressed'

export interface GateDecision {
  status: GateStatus
  /** Kurzer, deterministischer Grund-Code (testbar). */
  reason: string
  fingerprint: string
  candidate: TaskCandidate | null
}

// ── KUEPER-Outbox-Envelope ───────────────────────────────────────────────────
// Kern-Routingfelder (Router-Grenze) plus Protokoll-Provenienz. Der Router
// validiert Ownership gegen das Ecosystem-Registry; der Producer schlägt nur vor.
export interface OutboxEnvelope {
  // Kern-Routingfelder
  target: string
  title: string
  reason: string
  requested_change: string
  expected_result: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  parent_task: string          // leer bei Game-Ursprung
  depth: number
  affects: string[]
  cost_policy: string
  // Protokoll-Provenienz
  protocol: 'GAME_OBSERVATION_TASK_PROTOCOL'
  protocol_version: 'v0.1'
  candidate_id: string
  type: ObservationKind
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

// ── Aggregat (interner Sink-Zustand, serialisierbar) ─────────────────────────
export interface ObservationAggregate {
  fingerprint: string
  kind: ObservationKind
  system: string
  summary: string
  occurrences: number
  /** Höchste Einzel-Konfidenz aller Vorkommen. */
  max_confidence: number
  worlds: string[]               // unique, in Reihenfolge des Auftretens
  agents: string[]               // unique
  evidence_refs: string[]        // unique, capped
  reproduction: string[]
  expected: string
  actual: string
  first_observed_at: string
  last_observed_at: string
  emissions: number
  last_emitted_at: string | null
  parked: boolean
}
