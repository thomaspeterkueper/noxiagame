// lib/game/observation/producer.ts
// Erstellt:     21.08.2026
// Version:      0.1.0
//
// Outbox-Producer: wandelt am Gate bestandene TaskCandidates in gültige
// KUEPER-Outbox-Routing-Envelopes um und legt sie LOKAL unter
// `.kueper/outbox/` ab. Das ist die einzige Schreib-Grenze des Producers.
//
// Ausdrücklich NICHT hier: GitHub-API, Supabase, Repository-Mutation.
// Routing/Zustellung bleibt Aufgabe der Ecosystem-Schleife; der Producer
// schlägt das Ziel nur vor (der Router validiert Ownership).
//
// Hinweis: Dieses Modul importiert node:fs und ist NUR serverseitig zu
// verwenden. Der reine Teil (buildOutboxEnvelope, envelopeFilename) ist
// ohne IO nutzbar.
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

// ── IO-Grenze ────────────────────────────────────────────────────────────────

export interface OutboxWriter {
  write(filename: string, content: string): void
}

/** Standard-Verzeichnis: `<repo>/.kueper/outbox`. */
export function defaultOutboxDir(): string {
  return join(process.cwd(), '.kueper', 'outbox')
}

/** Datei-Writer in ein lokales Outbox-Verzeichnis (kein Netz, kein GitHub). */
export function createFileOutboxWriter(dir: string): OutboxWriter {
  return {
    write(filename: string, content: string): void {
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, filename), content, 'utf8')
    },
  }
}

// ── Envelope-Aufbau (pur) ────────────────────────────────────────────────────

export const PROTOCOL_ID = 'GAME_OBSERVATION_TASK_PROTOCOL'
export const PROTOCOL_VERSION = 'v0.1'

/** Stabiler, beschreibender Dateiname je Kandidat. */
export function envelopeFilename(candidate: TaskCandidate): string {
  return `${candidate.target}-${candidate.type}-${candidate.candidate_id}.json`
}

/**
 * TaskCandidate → KUEPER-Outbox-Routing-Envelope.
 * Kern-Routingfelder plus Protokoll-Provenienz (world/agent/evidence bleibt
 * an jedem Request erhalten). parent_task bleibt leer: Game-Ursprung hat
 * keinen Parent-Task.
 */
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
    protocol: PROTOCOL_ID,
    protocol_version: PROTOCOL_VERSION,
    candidate_id: candidate.candidate_id,
    type: candidate.type,
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

/** Kandidat als Envelope in den Outbox-Writer schreiben. */
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

// ── Producer (Sink + Gate + Outbox in einer Kette) ───────────────────────────

export interface IngestResult {
  decision: GateDecision
  envelope: OutboxEnvelope | null
  filename: string | null
}

export interface ObservationProducerOptions {
  sink?: LocalObservationSink
  writer?: OutboxWriter
  gateConfig?: Partial<GateConfig>
  /** Routing-Tiefe neuer Envelopes (Standard 1). */
  depth?: number
  affects?: string[]
}

/**
 * Bequeme Kette für Tester und Assertions:
 *   Observation -> Sink/Gate -> (approved?) Envelope -> lokaler Outbox-Writer.
 *
 * Der Writer ist injizierbar (Tests: In-Memory; Runtime: Datei-Writer in
 * `.kueper/outbox`). Ohne Writer wird nur gegatet, nie geschrieben.
 */
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

  /** Nimmt eine Observation auf; bei 'approved' wird der Envelope geschrieben. */
  ingest(obs: Observation, nowMs: number): IngestResult {
    const { decision } = this.sink.record(obs, nowMs)
    if (decision.status === 'approved' && decision.candidate && this.writer) {
      const { envelope, filename } = emitCandidate(decision.candidate, this.writer, this.depth, this.affects)
      return { decision, envelope, filename }
    }
    return { decision, envelope: null, filename: null }
  }
}

// ── Deterministische Game-Assertion ──────────────────────────────────────────
/**
 * Brücke für deterministische Game-Assertions: prüft eine Bedingung und
 * meldet einen Fehlschlag als reproduzierbare BUG-Observation durch die
 * Producer-Kette (Sink → Gate → Outbox-Writer).
 *
 * Ein bestandener Check erzeugt KEINE Observation — normale Game-Aktionen
 * dürfen keine Tasks erzeugen. Gibt das Ergebnis des Checks zurück, damit
 * die Assertion wie gewohnt durchgereicht werden kann.
 */
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
