// ============================================================
// NOXIA – Spielkonfiguration
// Erstellt: 31.05.2026
// Aktualisiert: 22.06.2026 — BUILDABLE_ITEMS in DB migriert (building_definitions)
// Version:      2.0.0
// ============================================================
//
// Diese Datei enthält ausschließlich Spielkonstanten.
// Gebäude-Definitionen leben ab Migration 027 in der Tabelle
// building_definitions (Supabase) — dort erweiterbar ohne
// Programmiereingriff.

// Ressourcenverbrauch pro 100 Einwohner pro Tick
export const CONSUMPTION_PER_100 = {
  water:  1.0,
  energy: 0.5,
  metal:  0.2,
} as const

// Bevölkerungswachstum pro Tick
export const GROWTH_RATE   = 0.0100  // +1% wenn versorgt
export const DECLINE_RATE  = 0.0200  // -2% wenn nicht versorgt

// Preisanpassung pro Tick
export const PRICE_PRESSURE_HIGH  = 1.05  // +5% wenn stock < LOW_THRESHOLD
export const PRICE_PRESSURE_LOW   = 0.96  // -4% wenn stock > HIGH_THRESHOLD
export const STOCK_LOW_THRESHOLD  = 50
export const STOCK_HIGH_THRESHOLD = 400

// Preisgrenzen
export const PRICE_MIN = 10
export const PRICE_MAX = 500

// Transaktionsbasierter Preisimpuls (Spot-Handel)
// Kauf:    buy_price  × (1 + PRICE_IMPULSE_PER_TON × menge)
// Verkauf: sell_price × (1 − PRICE_IMPULSE_PER_TON × menge)
export const PRICE_IMPULSE_PER_TON = 0.003

// Auftrags-Generator
export const ORDER_MIN_AMOUNT    = 10
export const ORDER_MAX_AMOUNT    = 30
export const ORDER_REWARD_MULT   = 1.3
export const ORDER_EXPIRE_HOURS  = 24
export const ORDER_COVERAGE_TICKS = 4

// Cron Secret Header
export const CRON_SECRET_HEADER = 'x-cron-secret'

// Startkapital neuer Spieler
export const STARTING_CREDITS = 5000

// Frachter-Laderaum
export const SHIP_CARGO_MAX = 100

// Maximaler Verhandlungsaufschlag über die Basis-Belohnung
export const ORDER_BONUS_MAX = 0.5   // bis zu +50%

// Berechnet die maximale Belohnung eines Auftrags aus seiner Dringlichkeit.
export function orderMaxReward(
  reward: number,
  expiresAt: string | null,
  stock: number | null,
): number {
  let urgency = 0.25

  if (expiresAt) {
    const hoursLeft = (new Date(expiresAt).getTime() - Date.now()) / 3.6e6
    if (hoursLeft < 6) urgency += 0.15
    if (hoursLeft < 2) urgency += 0.10
  }

  if (stock != null && stock < 30) urgency += 0.15

  return Math.round(reward * (1 + Math.min(ORDER_BONUS_MAX, urgency)))
}
