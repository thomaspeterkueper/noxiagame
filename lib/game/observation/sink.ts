// lib/game/observation/sink.ts
// Erstellt:     21.08.2026
// Version:      0.1.1
//
// Lokaler Observation-Sink für deterministische Game-Assertions und
// NOXIA_TESTER_INTELLIGENT_01.
//
// Persistente Finding-Semantik:
//   UNEMITTED -> OPEN -> RESOLVED -> REGRESSION/OPEN
//
// Ein bereits emittierter, weiterhin offener Befund erzeugt unabhängig von
// verstrichener Zeit keinen zweiten Entwicklungsrequest. Weitere Vorkommen
// aktualisieren nur occurrences/Evidence. Erst ein explizit RESOLVED gesetzter
// Befund darf bei erneutem Auftreten als REGRESSION wieder emittieren.
//
// Der Sink schreibt nichts nach GitHub/Supabase/Dateisystem. Zeit wird als
// nowMs-Parameter übergeben; Snapshot/Restore bleibt deterministisch.
// ─────────────────────────────────────────────────────────────────────────────

import { observationFingerprint } from './fingerprint.ts'
import {
  DEFAULT_GATE_CONFIG,
  COST_POLICY_BY_KIND,
  type FindingEvent,
  type GateConfig,
  type GateDecision,
  type Observation,
  type ObservationAggregate,
  type TaskCandidate,
} from './types.ts'

const MAX_RECORDS = 100
const MAX_CANDIDATES = 50

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
  version: 2
  aggregates: ObservationAggregate[]
  world_emissions: Record<string, number>
  records: Array<{ observation_id: string; fingerprint: string; observed_at: string }>
  candidates: TaskCandidate[]
}

export class LocalObservationSink {
  private readonly config: GateConfig
  private readonly aggregates = new Map<string, ObservationAggregate>()
  private readonly worldEmissions = new Map<string, number>()
  private readonly records: Array<{ observation_id: string; fingerprint: string; observed_at: string }> = []
  private readonly candidates: TaskCandidate[] = []

  constructor(config: Partial<GateConfig> = {}) {
    this.config = { ...DEFAULT_GATE_CONFIG, ...config }
  }

  record(obs: Observation, nowMs: number): RecordResult {
    const fingerprint = observationFingerprint(obs)
    const observedAt = obs.observed_at ?? iso(nowMs)
    const agg = this.upsertAggregate(fingerprint, obs, observedAt)
    this.pushRecord(fingerprint, observedAt)

    const decision = this.decide(agg, obs, observedAt)
    if (decision.candidate) {
      const isRegression = decision.candidate.finding_event === 'REGRESSION'
      agg.emissions += 1
      agg.last_emitted_at = observedAt
      agg.finding_status = 'OPEN'
      agg.resolved_at = null
      if (isRegression) agg.regressions += 1
      this.worldEmissions.set(obs.world_id, (this.worldEmissions.get(obs.world_id) ?? 0) + 1)
      this.candidates.push(decision.candidate)
      if (this.candidates.length > MAX_CANDIDATES) this.candidates.shift()
    }
    return { observation_id: this.lastObservationId(fingerprint), fingerprint, decision }
  }

  /** Expliziter Lifecycle-Übergang. Nur ein bereits emittierter OPEN-Befund kann gelöst werden. */
  markResolved(fingerprint: string, nowMs: number): boolean {
    const agg = this.aggregates.get(fingerprint)
    if (!agg || agg.finding_status !== 'OPEN') return false
    agg.finding_status = 'RESOLVED'
    agg.resolved_at = iso(nowMs)
    return true
  }

  private decide(
    agg: ObservationAggregate,
    obs: Observation,
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

    // Kerninvariante: Zeit allein darf einen ungelösten Befund nie erneut emittieren.
    if (agg.finding_status === 'OPEN') {
      return { status: 'suppressed', reason: 'finding_still_open', fingerprint: agg.fingerprint, candidate: null }
    }

    if ((this.worldEmissions.get(obs.world_id) ?? 0) >= c.max_candidates_per_world) {
      return { status: 'suppressed', reason: 'world_emission_cap', fingerprint: agg.fingerprint, candidate: null }
    }

    const event: FindingEvent = agg.finding_status === 'RESOLVED' ? 'REGRESSION' : 'INITIAL'
    const reason = event === 'REGRESSION' ? 'regression_after_resolution' : 'gate_passed'
    return {
      status: 'approved',
      reason,
      fingerprint: agg.fingerprint,
      candidate: this.buildCandidate(agg, obs, observedAt, event),
    }
  }

  private buildCandidate(
    agg: ObservationAggregate,
    obs: Observation,
    observedAt: string,
    findingEvent: FindingEvent,
  ): TaskCandidate {
    const c = this.config
    const prefix = findingEvent === 'REGRESSION' ? 'REGRESSION: ' : ''
    return {
      candidate_id: agg.fingerprint,
      source: c.source,
      target: obs.target ?? c.default_target,
      type: agg.kind,
      finding_event: findingEvent,
      title: `${prefix}${agg.kind}: ${agg.summary}`,
      reason: findingEvent === 'REGRESSION'
        ? `Previously resolved ${agg.kind} recurred (${agg.occurrences} total observations) in world ${obs.world_id} by ${obs.agent_id}.`
        : `Reproducible ${agg.kind} observation (${agg.occurrences}×) in world ${obs.world_id} by ${obs.agent_id}.`,
      requested_change: findingEvent === 'REGRESSION'
        ? 'Investigate the regression and restore the previously resolved behavior without bypassing canonical game rules.'
        : 'Investigate and repair the observed condition without bypassing canonical game rules.',
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
        finding_status: 'UNEMITTED',
        resolved_at: null,
        regressions: 0,
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
    if (agg.reproduction.length === 0 && (obs.reproduction?.length ?? 0) > 0) {
      agg.reproduction = [...(obs.reproduction as string[])]
    }
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

  aggregateList(): ObservationAggregate[] {
    return [...this.aggregates.values()]
  }

  aggregate(fingerprint: string): ObservationAggregate | undefined {
    return this.aggregates.get(fingerprint)
  }

  candidateList(): TaskCandidate[] {
    return [...this.candidates]
  }

  worldEmissionCount(worldId: string): number {
    return this.worldEmissions.get(worldId) ?? 0
  }

  toJSON(): SinkSnapshot {
    return {
      version: 2,
      aggregates: [...this.aggregates.values()].map((agg) => ({
        ...agg,
        worlds: [...agg.worlds],
        agents: [...agg.agents],
        evidence_refs: [...agg.evidence_refs],
        reproduction: [...agg.reproduction],
      })),
      world_emissions: Object.fromEntries(this.worldEmissions),
      records: [...this.records],
      candidates: [...this.candidates],
    }
  }

  static fromJSON(snapshot: SinkSnapshot, config: Partial<GateConfig> = {}): LocalObservationSink {
    if (snapshot.version !== 2) throw new Error(`Unsupported observation sink snapshot version: ${snapshot.version}`)
    const sink = new LocalObservationSink(config)
    for (const source of snapshot.aggregates) {
      const agg: ObservationAggregate = {
        ...source,
        worlds: [...source.worlds],
        agents: [...source.agents],
        evidence_refs: [...source.evidence_refs],
        reproduction: [...source.reproduction],
      }
      sink.aggregates.set(agg.fingerprint, agg)
    }
    for (const [world, n] of Object.entries(snapshot.world_emissions)) sink.worldEmissions.set(world, n)
    sink.records.push(...snapshot.records)
    sink.candidates.push(...snapshot.candidates)
    return sink
  }
}

export const NOXIA_TESTER_INTELLIGENT_01 = 'NOXIA_TESTER_INTELLIGENT_01'
