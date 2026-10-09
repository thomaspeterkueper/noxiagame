// lib/game/populationGrowth.ts
// Erstellt:     09.10.2026 — deterministische Schrittweite für Bevölkerungsänderung
// Version:      1.0.0
//
// Problem: Math.round(pop * (1 + rate)) rundet kleine Änderungen weg. Bei
// GROWTH_RATE 0,02 % konnte eine Kolonie unter 2.500 Einwohnern nie wachsen,
// während der Rückgang (5 %) sofort griff.
//
// Lösung ohne Zufall und ohne neuen gespeicherten Zustand: Der Bruchteil wird
// über die Tick-Nummer verteilt. Bei einer erwarteten Änderung von 0,07 pro
// Tick fällt in 100 Ticks genau siebenmal ein ganzer Schritt an – immer in
// denselben Ticks, also reproduzierbar.

/** Ganzzahlige Änderung für diesen Tick bei erwarteter (gebrochener) Änderung `expected` ≥ 0. */
export function steppedDelta(expected: number, tickNumber: number): number {
  if (!Number.isFinite(expected) || expected <= 0) return 0
  const whole = Math.floor(expected)
  const frac = expected - whole
  const tick = Math.max(0, Math.floor(tickNumber))
  const extra = Math.floor((tick + 1) * frac) - Math.floor(tick * frac)
  return whole + extra
}

/** Neue Bevölkerung nach einem Tick (nicht überbelegt): Wachstum wenn versorgt, sonst Rückgang. */
export function nextPopulation(input: {
  population: number
  populationMax: number
  supplied: boolean
  growthRate: number
  declineRate: number
  tickNumber: number
}): number {
  const { population, populationMax, supplied, growthRate, declineRate, tickNumber } = input
  if (supplied) {
    return Math.min(populationMax, population + steppedDelta(population * growthRate, tickNumber))
  }
  return Math.max(0, population - steppedDelta(population * declineRate, tickNumber))
}
