// transfer.ts
// Aktualisiert: 09.10.2026 — Linienflug-Fahrpreis (PASSENGER_TICKET_CR_PER_ENERGY, passengerTicketPrice)
//               hierher verlegt, damit Server und Anzeige dieselbe Rechnung benutzen
// Version:      0.2.0
// Vorher:       Version 0.1.0 — geometry-driven interplanetary transfer model
//
// Pure, deterministic model. No DB access and no Date.now().
// The departure tick snapshots orbital geometry. Navigation proficiency only
// improves the optimisable transfer component; it never removes gravity costs.

import { distance, orbitalBaseSeconds, ORBITS } from './orbits'

export interface TransferOptions {
  /** 0..1. Reserved for the learning/knowledge layer. */
  navigationProficiency?: number
  /** Ship speed multiplier. 1 = baseline. */
  speedMult?: number
}

export interface TransferQuote {
  from: string
  to: string
  tick: number
  distance: number
  durationSeconds: number
  energy: number
  gravityEnergy: number
  transferEnergy: number
  navigationProficiency: number
  timeEfficiency: number
  energyEfficiency: number
}

// Abstract tonnes of energy required to depart/arrive. These are gameplay
// coefficients, not literal delta-v values. They preserve the important
// asymmetry: escaping Earth costs much more than returning to it.
const DEPARTURE_GRAVITY_ENERGY: Record<string, number> = {
  earth: 16,
  moon: 3,
  mars: 7,
  phobos: 1,
  deimos: 1,
  kepler: 1,
  prometheus: 1,
}

const ARRIVAL_MANEUVER_ENERGY: Record<string, number> = {
  earth: 1,
  moon: 1,
  mars: 2,
  phobos: 1,
  deimos: 1,
  kepler: 1,
  prometheus: 1,
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))

/**
 * Geometry-dependent transfer quote.
 *
 * Energy is composed of:
 *  - departure/arrival gravity & manoeuvre floor (not skill-discounted), and
 *  - transfer energy proportional to sqrt(distance), discounted by navigation.
 *
 * sqrt(distance) keeps nearby moon hops cheap while still making bad
 * Earth/Mars geometry materially more expensive without exploding linearly.
 */
export function transferQuote(
  from: string,
  to: string,
  tick: number,
  options: TransferOptions = {},
): TransferQuote | null {
  if (!ORBITS[from] || !ORBITS[to] || from === to) return null

  const navigationProficiency = clamp01(options.navigationProficiency ?? 0)
  const speedMult = Number(options.speedMult ?? 1)
  const safeSpeedMult = Number.isFinite(speedMult) && speedMult > 0 ? speedMult : 1
  const routeDistance = distance(from, to, tick)

  // Knowledge can optimise trajectory/launch window execution, but cannot
  // abolish physical travel time. Keep the ceiling modest for game balance.
  const timeEfficiency = 1 - navigationProficiency * 0.12
  const energyEfficiency = 1 - navigationProficiency * 0.15

  const baseSeconds = orbitalBaseSeconds(from, to, tick)
  const durationSeconds = Math.max(1, Math.round((baseSeconds * timeEfficiency) / safeSpeedMult))

  const gravityEnergy = (DEPARTURE_GRAVITY_ENERGY[from] ?? 3)
    + (ARRIVAL_MANEUVER_ENERGY[to] ?? 1)
  const rawTransferEnergy = Math.max(1, Math.sqrt(routeDistance) * 1.5)
  const transferEnergy = Math.max(1, Math.ceil(rawTransferEnergy * energyEfficiency))
  const energy = Math.max(1, gravityEnergy + transferEnergy)

  return {
    from,
    to,
    tick,
    distance: routeDistance,
    durationSeconds,
    energy,
    gravityEnergy,
    transferEnergy,
    navigationProficiency,
    timeEfficiency,
    energyEfficiency,
  }
}

// Linienflug-Fahrpreis ohne eigenes Schiff: dieselbe Energie-Abstraktion wie
// beim Schiffstransit, umgerechnet in Credits statt in Treibstoff -- der
// Spediteur verlangt eine Pauschale, kein eigener Energievorrat wird verbraucht.
export const PASSENGER_TICKET_CR_PER_ENERGY = 25

export function passengerTicketPrice(quote: Pick<TransferQuote, 'energy'>): number {
  return Math.round(quote.energy * PASSENGER_TICKET_CR_PER_ENERGY)
}
