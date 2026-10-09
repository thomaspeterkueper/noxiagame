// lib/game/pilotQualification.ts
// Erstellt:     09.10.2026 — Flugausbildung oder angeheuerter Pilot
// Version:      1.1.0 — gleiche Regel für alle Schiffe, mit Übergangsfrist
//
// Wer ein eigenes Schiff fliegt, braucht entweder die Raumfahrt- und
// Astronomie-Grundausbildung der Akademie oder einen angeheuerten Piloten.
// Reine Ableitung aus player_learning_progress – kein eigener Zustand.

import type { TransferQuote } from './transfer'

/** Flugausbildung: Gravitation (Raumfahrt-Physik) und Orbitalmechanik (Astronomie). */
export const PILOT_TRAINING_MODULES = ['PHY-1101', 'AST-2101'] as const

// Vorläufige Modellparameter (Entscheidung 09.10.2026), keine Dauerregeln:
// Die Module sind die Mindestqualifikation bis zu einem ordentlichen
// Lizenzsystem; der Tarif ist ein Testtarif, bis Honorare aus dem
// NPC-Arbeitsmarkt entstehen (angestellter oder je Flug beauftragter Pilot).

/** Honorar des je Flug beauftragten Piloten je Energieeinheit (Linienflug-Ticket: 25 Cr). */
export const PILOT_FEE_CR_PER_ENERGY = 10

/**
 * Ab diesem Tick gilt die Pilotenpflicht – für alle Schiffe gleich, unabhängig
 * vom Kaufdatum. Bis dahin (48 Ticks Übergangsfrist ab Einführung bei Tick
 * 2135) fällt kein Honorar an, damit Bestandsbesitzer nicht überrascht werden.
 */
export const PILOT_RULE_EFFECTIVE_TICK = 2183

export function pilotRuleActive(tick: number): boolean {
  return tick >= PILOT_RULE_EFFECTIVE_TICK
}

/** Vergleicht nach dem Modulkürzel, unabhängig vom ID-Präfix (z. B. „LRN:SSF:“). */
export function hasPilotTraining(completedModuleIds: string[]): boolean {
  const done = new Set(completedModuleIds.map(id => id.slice(id.lastIndexOf(':') + 1)))
  return PILOT_TRAINING_MODULES.every(code => done.has(code))
}

/** Honorar für einen Flug; 0 mit eigener Flugausbildung oder während der Übergangsfrist. */
export function pilotFee(quote: Pick<TransferQuote, 'energy'>, trained: boolean, tick: number): number {
  if (trained || !pilotRuleActive(tick)) return 0
  return Math.round(quote.energy * PILOT_FEE_CR_PER_ENERGY)
}
