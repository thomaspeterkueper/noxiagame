// lib/game/observation/producer.ts
// Erstellt:     21.08.2026
// Version:      0.1.1
//
// Outbox-Producer: wandelt am Gate bestandene TaskCandidates in gültige
// KUEPER-Outbox-Routing-Envelopes um und legt sie LOKAL unter
// `.kueper/outbox/` ab. Das ist die einzige Schreib-Grenze des Producers.
//
// Ausdrücklich NICHT hier: GitHub-API, Supabase, Repository-Mutation.
// Routing/Zustellung bleibt Aufgabe der Ecosystem-Schleife; der Producer
// schlägt das Ziel nur vor (der Router validiert Ownership).
// ─────────────────────────────────────────────────────────────────────────────

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { LocalObservationSink } from './sink.ts'
import {
  PRIORITY_BY_KIND,
  type EvidenceItem,
  type GateConfig,
  type GateDecision,
  type Observation,
  type OutboxEnvelope,
  type TaskCandidate,
} from './types.ts'

export interface OutboxWriter {
  write(filename: string, content: string): void
}

export function defaultOutboxDir(): string {
  return join(process.cwd(), '.kueper', 'outbox')
}

export function createFileOutboxWriter(dir: string): OutboxWriter {
  return {
    write(filename: string, content: string): void {
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, filename), content, 'utf8')
    },
  }
}

export const PROTOCOL_ID = 'GAME_OBSERVATION_TASK_PROTOCOL'
export const PROTOCOL_VERSION = 'v0.1'

export function envelopeFilename(candidate: TaskCandidate): string {
  return `${candidate.target}-${candidate.type}-${candidate.candidate_id}.json`
}

export function buildOutboxEnvelope(
  candidate: TaskCandidate,
  depth: number,
  affects: string[] = ['game-logic'],
): OutboxEnvelope {
  return {
    target: candidate.target,
    title: candidate.title,
    reason: candidate.reason,
    requested_change: candidate.requested_change,
    expected_result: candidate.expected_result,
    priority: PRIORITY_BY_KIND[candidate.type],
    parent_task: '',
    depth,
    affects,
    cost_policy: candidate.cost_policy,
    estimated_effort: candidate.estimated_effort,
    protocol: PROTOCOL_ID,
    protocol_version: PROTOCOL_VERSION,
    candidate_id: candidate.candidate_id,
    type: candidate.type,
    finding_event: candidate.finding_event,
    world_id: candidate.world_id,
    agent_id: candidate.agent_id,
    occurrences: candidate.occurrences,
    confidence: candidate.confidence,
    evidence_refs: candidate.evidence_refs,
    reproduction: candidate.reproduction,
    expected: candidate.expected,
    actual: candidate.actual,
    observed_at: candidate.observed_at,
  }
}

export function emitCandidate(
  candidate: TaskCandidate,
  writer: OutboxWriter,
  depth: number,
  affects?: string[],
): { envelope: OutboxEnvelope; filename: string } {
  const envelope = buildOutboxEnvelope(candidate, depth, affects)
  const filename = envelopeFilename(candidate)
  writer.write(filename, JSON.stringify(envelope, null, 2) + '\n')
  return { envelope, filename }
}

export interface IngestResult {
  decision: GateDecision
  envelope: OutboxEnvelope | null
  filename: string | null
}

export interface ObservationProducerOptions {
  sink?: LocalObservationSink
  writer?: OutboxWriter
  gateConfig?: Partial<GateConfig>
  depth?: number
  affects?: string[]
}

export class ObservationProducer {
  readonly sink: LocalObservationSink
  private readonly writer: OutboxWriter | null
  private readonly depth: number
  private readonly affects: string[]

  constructor(options: ObservationProducerOptions = {}) {
    this.sink = options.sink ?? new LocalObservationSink(options.gateConfig)
    this.writer = options.writer ?? null
    this.depth = options.depth ?? 1
    this.affects = options.affects ?? ['game-logic']
  }

  ingest(obs: Observation, nowMs: number): IngestResult {
    const { decision } = this.sink.record(obs, nowMs)
    if (decision.status === 'approved' && decision.candidate && this.writer) {
      const { envelope, filename } = emitCandidate(decision.candidate, this.writer, this.depth, this.affects)
      return { decision, envelope, filename }
    }
    return { decision, envelope: null, filename: null }
  }
}

export function recordAssertion(
  producer: ObservationProducer,
  opts: {
    world_id: string
    agent_id: string
    system: string
    summary: string
    check: () => boolean
    expected: string
    actual: string | (() => string)
    confidence?: number
    evidence?: EvidenceItem[]
  },
  nowMs: number,
): boolean {
  const ok = opts.check()
  if (!ok) {
    const actualValue = typeof opts.actual === 'function' ? opts.actual() : opts.actual
    producer.ingest(
      {
        world_id: opts.world_id,
        agent_id: opts.agent_id,
        kind: 'BUG',
        system: opts.system,
        summary: opts.summary,
        expected: opts.expected,
        actual: actualValue,
        confidence: opts.confidence ?? 1,
        evidence: opts.evidence,
        reproduction: [
          `Re-run deterministic assertion '${opts.summary}'`,
          `system: ${opts.system}`,
          `expected: ${opts.expected}`,
          `actual: ${actualValue}`,
        ],
      },
      nowMs,
    )
  }
  return ok
}
