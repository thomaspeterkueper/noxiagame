// lib/game/pilotQualification.ts
// Erstellt:     09.10.2026 — Flugausbildung oder angeheuerter Pilot
// Version:      1.0.0
//
// Wer ein eigenes Schiff fliegt, braucht entweder die Raumfahrt- und
// Astronomie-Grundausbildung der Akademie oder einen angeheuerten Piloten.
// Reine Ableitung aus player_learning_progress – kein eigener Zustand.

import type { TransferQuote } from './transfer'

/** Flugausbildung: Gravitation (Raumfahrt-Physik) und Orbitalmechanik (Astronomie). */
export const PILOT_TRAINING_MODULES = ['PHY-1101', 'AST-2101'] as const

/** Honorar des angeheuerten Piloten je Energieeinheit des Flugs (Linienflug-Ticket: 25 Cr). */
export const PILOT_FEE_CR_PER_ENERGY = 10

/** Vergleicht nach dem Modulkürzel, unabhängig vom ID-Präfix (z. B. „LRN:SSF:“). */
export function hasPilotTraining(completedModuleIds: string[]): boolean {
  const done = new Set(completedModuleIds.map(id => id.slice(id.lastIndexOf(':') + 1)))
  return PILOT_TRAINING_MODULES.every(code => done.has(code))
}

/** Honorar für einen Flug; 0 mit eigener Flugausbildung. */
export function pilotFee(quote: Pick<TransferQuote, 'energy'>, trained: boolean): number {
  return trained ? 0 : Math.round(quote.energy * PILOT_FEE_CR_PER_ENERGY)
}
