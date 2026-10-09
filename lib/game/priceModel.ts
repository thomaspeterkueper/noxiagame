// lib/game/priceModel.ts
// Erstellt:     09.10.2026 — Preis aus der Reichweite des Lagers statt aus festen Tonnen-Schwellen
// Version:      1.0.0
//
// Bisher: +5 % unter 50 t, −4 % über 400 t, für jede Kolonie gleich. Folgen:
// eine Kolonie mit 25 Einwohnern und 200 t Wasser lag dauerhaft im neutralen
// Bereich, und am unteren Ende hielt die Rundung den Preis fest
// (12 × 0,96 = 11,52 → 12).
//
// Jetzt: Der Zielpreis folgt der Reichweite des Lagers – wie viele Ticks der
// Bestand beim aktuellen Verbrauch reicht. Der Marktpreis bewegt sich jeden
// Tick einen Anteil der Lücke auf den Zielpreis zu, mindestens 1 Cr, ohne ihn
// zu überspringen. Deterministisch, ohne Zufall und ohne eigenen Zustand:
// alles leitet sich aus Bestand, Verbrauch und dem aktuellen Preis ab.

import { PRICE_MAX, PRICE_MIN } from './config'

/** Richtpreis (Kauf) je Tonne bei ausgeglichener Versorgung. */
export const PRICE_BASE: Record<string, number> = { water: 120, energy: 60, metal: 40 }

/** Reichweite in Ticks, bei der genau der Richtpreis gilt (48 Ticks = 2 Tage Echtzeit). */
export const PRICE_COVERAGE_TARGET_TICKS = 48

/** Grenzen des Knappheitsfaktors: Überfluss kostet ein Viertel, Mangel höchstens das Vierfache des Richtpreises. */
export const PRICE_SCARCITY_MIN = 0.25
export const PRICE_SCARCITY_MAX = 4

/** Anteil der Lücke zum Zielpreis, den der Markt pro Tick schließt. */
export const PRICE_ADJUST_SHARE = 0.1

/** Ankaufspreis des Markts im Verhältnis zum Verkaufspreis an Spieler. */
export const PRICE_SELL_RATIO = 0.75
const PRICE_MIN_SPREAD = 5

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

/**
 * Zielpreis (Kauf) aus der Lagerreichweite. `null`, wenn es kein Marktsignal
 * gibt: unbekanntes Gut oder kein Verbrauch am Ort.
 */
export function targetBuyPrice(input: { resource: string; stock: number; consumption: number }): number | null {
  const base = PRICE_BASE[input.resource]
  if (!base || !(input.consumption > 0)) return null
  const coverageTicks = Math.max(0, input.stock) / input.consumption
  // Wurzel: doppelte Reichweite senkt den Preis um rund 30 %, nicht um die Hälfte.
  const factor = coverageTicks <= 0
    ? PRICE_SCARCITY_MAX
    : clamp(Math.sqrt(PRICE_COVERAGE_TARGET_TICKS / coverageTicks), PRICE_SCARCITY_MIN, PRICE_SCARCITY_MAX)
  return clamp(Math.round(base * factor), PRICE_MIN, PRICE_MAX)
}

/** Ein Schritt vom aktuellen Preis auf den Zielpreis zu: mindestens 1 Cr, nie darüber hinaus. */
export function stepToward(current: number, target: number, share = PRICE_ADJUST_SHARE): number {
  const gap = target - current
  if (gap === 0) return current
  const step = Math.max(1, Math.round(Math.abs(gap) * share))
  return gap > 0 ? Math.min(target, current + step) : Math.max(target, current - step)
}

/** Ankaufspreis des Markts zu einem Kaufpreis. */
export function sellPriceFor(buyPrice: number): number {
  return Math.max(1, Math.min(buyPrice - PRICE_MIN_SPREAD, Math.round(buyPrice * PRICE_SELL_RATIO)))
}

/** Neuer Marktpreis nach einem Tick; ohne Marktsignal bleibt der Preis, wie er ist. */
export function nextMarketPrice(input: {
  resource: string
  buyPrice: number
  sellPrice: number
  stock: number
  consumption: number
}): { buy: number; sell: number; target: number | null } {
  const target = targetBuyPrice(input)
  if (target === null) return { buy: input.buyPrice, sell: input.sellPrice, target }
  const buy = stepToward(input.buyPrice, target)
  return { buy, sell: sellPriceFor(buy), target }
}
