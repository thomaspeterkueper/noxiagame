// lib/game/observation/fingerprint.ts
// Erstellt:     21.08.2026
// Version:      0.1.0
//
// Stabile Fingerprints für Game-Observations.
//
// Der Fingerprint identifiziert die ZUGUNDE LIEGENDE BEDINGUNG, nicht die
// einzelne Beobachtung: kind + system + normalisierte summary. Welt und Agent
// gehen bewusst NICHT ein, damit Vorkommen derselben Bedingung über Welten und
// Agenten hinweg zu EINEM TaskCandidate aggregieren (Protokoll-Gate:
// „number of independent occurrences/agents/worlds“). Die Provenienz
// (world_id, agent_id, evidence) bleibt trotzdem an jedem Request erhalten.
//
// Zwei unabhängige FNV-1a-32-Pässe (Math.imul, wie der World-Analyzer) über
// einen kanonischen Schlüssel, konkateniert zu 16 Hex-Zeichen:
// deterministisch über Plattformen und Läufe, ES2017-kompatibel, keine
// Abhängigkeiten, kein Date.now/Random. Für v0.1 als Idempotenzschlüssel
// ausreichend; kein kryptografischer Anspruch.
// ─────────────────────────────────────────────────────────────────────────────

const FNV_OFFSET_A = 0x811c9dc5
const FNV_PRIME_A  = 0x01000193
const FNV_OFFSET_B = 0x9e3779b9
const FNV_PRIME_B  = 0x85ebca6b

function fnv1a32(key: string, offset: number, prime: number): number {
  let hash = offset
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i)
    hash = Math.imul(hash, prime)
  }
  return hash >>> 0
}

/** 64 Bit als zwei dekorrelierte FNV-1a-32-Pässe, hexadezimal, 16 Zeichen. */
export function stableFingerprint(key: string): string {
  const a = fnv1a32(key, FNV_OFFSET_A, FNV_PRIME_A).toString(16).padStart(8, '0')
  const b = fnv1a32(key, FNV_OFFSET_B, FNV_PRIME_B).toString(16).padStart(8, '0')
  return a + b
}

/** Normalisierung: trimmen, Kleinbuchstaben, Whitespace kollabieren. */
export function normalizeCondition(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Kanonischer Schlüssel der zugrunde liegenden Bedingung.
 * Groß-/Kleinschreibung und Whitespace der summary sind irrelevant.
 */
export function conditionKey(kind: string, system: string, summary: string): string {
  return `${kind.trim().toUpperCase()}|${normalizeCondition(system)}|${normalizeCondition(summary)}`
}

/** Fingerprint einer Observation = Fingerprint der zugrunde liegenden Bedingung. */
export function observationFingerprint(o: {
  kind: string
  system: string
  summary: string
}): string {
  return stableFingerprint(conditionKey(o.kind, o.system, o.summary))
}
