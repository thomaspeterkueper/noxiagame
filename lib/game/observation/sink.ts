// lib/game/observation/sink.ts
// Erstellt:     21.08.2026
// Version:      0.1.0
//
// Lokaler Observation-Sink für deterministische Game-Assertions und
// NOXIA_TESTER_INTELLIGENT_01.
//
// Was er tut (und was nicht):
//   • aufnehmen   — record() aggregiert Vorkommen über stabile Fingerprints
//   • gaten       — BUG/DEAD_END steigen nach EINEM hoch-konfidenten,
//                   reproduzierbaren Auftreten auf; PROPOSAL wird geparkt,
//                   alle übrigen Kinds werden in v0.1 nur aggregiert
//   • begrenzen   — Cooldown je Fingerprint, Kandidaten-Obergrenze je Welt
//   • NICHTS schreiben — kein GitHub, kein Supabase, kein Dateisystem.
//                   Emission ist Sache des Producers (lib/game/observation/producer.ts)
//
// Pur und deterministisch: Zeit kommt als nowMs-Parameter, keine Globals,
// keine Zufallszahlen. Der Sink ist damit direkt in deterministischen
// Game-Assertions nutzbar (siehe recordAssertion) und serialisierbar
// (toJSON/fromJSON) für persistente Tester-Zustände.
// ─────────────────────────────────────────────────────────────────────────────

import { observationFingerprint } from './fingerprint.ts'
import {
  DEFAULT_GATE_CONFIG,
  COST_POLICY_BY_KIND,
  type GateConfig,
  type GateDecision,
  type Observation,
  type ObservationAggregate,
  type TaskCandidate,
} from './types.ts'

// ── Grenzen des Sinks (bounded memory) ───────────────────────────────────────
const MAX_RECORDS    = 100   // Roh-Observations im Ring
const MAX_CANDIDATES = 50    // Kandidaten-Historie

/** RFC3339 aus epoch-ms — deterministisch für festes nowMs. */
function iso(nowMs: number): string {
  return new Date(nowMs).toISOString()
}

function pushUnique(list: string[], value: string): void {
  if (!list.includes(value)) list.push(value)
}

export interface RecordResult {
  observation_id: string
  fingerprint: string
  decision: GateDecision
}

export interface SinkSnapshot {
  version: 1
  aggregates: ObservationAggregate[]
  world_emissions: Record<string, number>
  records: Array<{ observation_id: string; fingerprint: string; observed_at: string }>
  candidates: TaskCandidate[]
}

// ── Sink ─────────────────────────────────────────────────────────────────────
export class LocalObservationSink {
  private readonly config: GateConfig
  private readonly aggregates = new Map<string, ObservationAggregate>()
  private readonly worldEmissions = new Map<string, number>()
  private readonly records: Array<{ observation_id: string; fingerprint: string; observed_at: string }> = []
  private readonly candidates: TaskCandidate[] = []

  constructor(config: Partial<GateConfig> = {}) {
    this.config = { ...DEFAULT_GATE_CONFIG, ...config }
  }

  /**
   * Nimmt eine Observation auf, aggregiert sie über den Fingerprint und
   * bewertet sie am Gate. Bei 'approved' wird der TaskCandidate erzeugt,
   * gezählt und in die Kandidaten-Historie aufgenommen — geschrieben wird
   * hier NICHTS (Emission übernimmt der Producer).
   */
  record(obs: Observation, nowMs: number): RecordResult {
    const fingerprint = observationFingerprint(obs)
    const observedAt = obs.observed_at ?? iso(nowMs)

    const agg = this.upsertAggregate(fingerprint, obs, observedAt)
    this.pushRecord(fingerprint, observedAt)

    const decision = this.decide(agg, obs, nowMs, observedAt)
    if (decision.candidate) {
      agg.emissions += 1
      agg.last_emitted_at = observedAt
      this.worldEmissions.set(obs.world_id, (this.worldEmissions.get(obs.world_id) ?? 0) + 1)
      this.candidates.push(decision.candidate)
      if (this.candidates.length > MAX_CANDIDATES) this.candidates.shift()
    }
    return { observation_id: this.lastObservationId(fingerprint), fingerprint, decision }
  }

  /** Bewertung am Gate — pure Funktion auf dem Aggregat + Config. */
  private decide(
    agg: ObservationAggregate,
    obs: Observation,
    nowMs: number,
    observedAt: string,
  ): GateDecision {
    const c = this.config
    if (c.parked_kinds.includes(obs.kind)) {
      agg.parked = true
      return { status: 'parked', reason: 'kind_parked_proposal', fingerprint: agg.fingerprint, candidate: null }
    }
    if (!c.auto_promotable_kinds.includes(obs.kind)) {
      return { status: 'aggregating', reason: 'kind_not_auto_promotable_v0_1', fingerprint: agg.fingerprint, candidate: null }
    }
    if (agg.max_confidence < c.min_confidence) {
      return { status: 'aggregating', reason: 'confidence_below_threshold', fingerprint: agg.fingerprint, candidate: null }
    }
    if (agg.reproduction.length < c.min_reproduction_steps) {
      return { status: 'aggregating', reason: 'not_reproducible', fingerprint: agg.fingerprint, candidate: null }
    }
    if (agg.emissions > 0) {
      const last = agg.last_emitted_at ? Date.parse(agg.last_emitted_at) : 0
      if (nowMs - last < c.cooldown_ms) {
        return { status: 'suppressed', reason: 'cooldown_active', fingerprint: agg.fingerprint, candidate: null }
      }
    }
    if ((this.worldEmissions.get(obs.world_id) ?? 0) >= c.max_candidates_per_world) {
      return { status: 'suppressed', reason: 'world_emission_cap', fingerprint: agg.fingerprint, candidate: null }
    }
    return { status: 'approved', reason: 'gate_passed', fingerprint: agg.fingerprint, candidate: this.buildCandidate(agg, obs, observedAt) }
  }

  private buildCandidate(agg: ObservationAggregate, obs: Observation, observedAt: string): TaskCandidate {
    const c = this.config
    return {
      candidate_id: agg.fingerprint,
      source: c.source,
      target: obs.target ?? c.default_target,
      type: agg.kind,
      title: `${agg.kind}: ${agg.summary}`,
      reason: `Reproducible ${agg.kind} observation (${agg.occurrences}×) in world ${obs.world_id} by ${obs.agent_id}.`,
      requested_change: 'Investigate and repair the observed condition without bypassing canonical game rules.',
      expected_result: agg.expected,
      evidence_refs: [...agg.evidence_refs],
      occurrences: agg.occurrences,
      confidence: agg.max_confidence,
      cost_policy: COST_POLICY_BY_KIND[agg.kind],
      estimated_effort: 'medium',
      world_id: obs.world_id,
      agent_id: obs.agent_id,
      reproduction: [...agg.reproduction],
      expected: agg.expected,
      actual: agg.actual,
      observed_at: observedAt,
    }
  }

  // ── Aggregation ────────────────────────────────────────────────────────────

  private upsertAggregate(fingerprint: string, obs: Observation, observedAt: string): ObservationAggregate {
    let agg = this.aggregates.get(fingerprint)
    if (!agg) {
      agg = {
        fingerprint,
        kind: obs.kind,
        system: obs.system,
        summary: obs.summary.trim(),
        occurrences: 0,
        max_confidence: 0,
        worlds: [],
        agents: [],
        evidence_refs: [],
        reproduction: [],
        expected: obs.expected,
        actual: obs.actual,
        first_observed_at: observedAt,
        last_observed_at: observedAt,
        emissions: 0,
        last_emitted_at: null,
        parked: false,
      }
      this.aggregates.set(fingerprint, agg)
    }

    agg.occurrences += 1
    agg.last_observed_at = observedAt
    pushUnique(agg.worlds, obs.world_id)
    pushUnique(agg.agents, obs.agent_id)
    for (const ev of obs.evidence ?? []) {
      pushUnique(agg.evidence_refs, ev.ref)
      if (agg.evidence_refs.length > this.config.max_evidence_refs) {
        agg.evidence_refs.length = this.config.max_evidence_refs
      }
    }
    // Reproduktionsschritte: erste nicht-leere Menge wird repräsentativ.
    if (agg.reproduction.length === 0 && (obs.reproduction?.length ?? 0) > 0) {
      agg.reproduction = [...(obs.reproduction as string[])]
    }
    // Repräsentative expected/actual/summary: von der höchst-konfidenten Beobachtung.
    if (obs.confidence > agg.max_confidence) {
      agg.max_confidence = obs.confidence
      agg.expected = obs.expected
      agg.actual = obs.actual
      agg.summary = obs.summary.trim()
    }
    return agg
  }

  private pushRecord(fingerprint: string, observedAt: string): void {
    const id = `${fingerprint}-${String(this.records.length + 1).padStart(4, '0')}`
    this.records.push({ observation_id: id, fingerprint, observed_at: observedAt })
    if (this.records.length > MAX_RECORDS) this.records.shift()
  }

  private lastObservationId(fingerprint: string): string {
    for (let i = this.records.length - 1; i >= 0; i--) {
      if (this.records[i].fingerprint === fingerprint) return this.records[i].observation_id
    }
    return `${fingerprint}-0001`
  }

  // ── Lesen ──────────────────────────────────────────────────────────────────

  /** Alle Aggregate in Reihenfolge des ersten Auftretens. */
  aggregateList(): ObservationAggregate[] {
    return [...this.aggregates.values()]
  }

  aggregate(fingerprint: string): ObservationAggregate | undefined {
    return this.aggregates.get(fingerprint)
  }

  /** Historie der am Gate bestandenen TaskCandidates. */
  candidateList(): TaskCandidate[] {
    return [...this.candidates]
  }

  /** Anzahl emittierter Kandidaten einer Welt (für Tests/Caps). */
  worldEmissionCount(worldId: string): number {
    return this.worldEmissions.get(worldId) ?? 0
  }

  // ── Persistenz (für den Tester-Zyklus; pur, kein IO) ───────────────────────

  toJSON(): SinkSnapshot {
    return {
      version: 1,
      aggregates: [...this.aggregates.values()],
      world_emissions: Object.fromEntries(this.worldEmissions),
      records: [...this.records],
      candidates: [...this.candidates],
    }
  }

  static fromJSON(snapshot: SinkSnapshot, config: Partial<GateConfig> = {}): LocalObservationSink {
    const sink = new LocalObservationSink(config)
    for (const agg of snapshot.aggregates) sink.aggregates.set(agg.fingerprint, agg)
    for (const [world, n] of Object.entries(snapshot.world_emissions)) sink.worldEmissions.set(world, n)
    sink.records.push(...snapshot.records)
    sink.candidates.push(...snapshot.candidates)
    return sink
  }
}

/** Agenten-ID des ersten NOXIA-Testers (Protokoll-Referenz). */
export const NOXIA_TESTER_INTELLIGENT_01 = 'NOXIA_TESTER_INTELLIGENT_01'
