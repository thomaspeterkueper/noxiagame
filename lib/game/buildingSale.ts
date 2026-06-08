// lib/game/buildingSale.ts
// Marktwertbasierte Gebäudebewertung (siehe SPEC_gebaeude-verkauf.md)
// Reine Funktionen ohne DB-Zugriff – testbar und vom Client wiederverwendbar.
// NEU: Zustand (condition) mindert den Verkaufswert über das geteilte condition.ts.

import { BUILDABLE_ITEMS } from './config'
import { conditionFactor, getRepairQuote } from './condition'

export const BUILDING_SALE = {
  FAKTOR: 20,                 // Kapitalisierungsmultiplikator
  RUECKBAU_PCT: 0.20,         // Rückbau = 20% der Baukosten
  BESTAND_PREMIUM: 1.05,      // Untergrenze profitabler Gebäude
  MIETWERT_PRO_PLATZ: 1,      // Cr/Tick pro belegtem Habitat-Platz
  UMSIEDLUNG_PRO_PERSON: 5,   // Cr pro verdrängtem Einwohner
  VERKAUFSDAUER_TICKS: 2,     // Regulärer Verkauf dauert 2 Ticks
  SOFORT_ABSCHLAG: 0.15,      // Sofortverkauf: 15% Abschlag auf Ertragswert
  PROFIT_SCHWELLE: 15,        // ab hier gilt ein Gut als profitabel
} as const

export type BuildableId = 'mine' | 'solar' | 'habitat'
export type SaleMode = 'normal' | 'instant'

export interface SaleContext {
  buildableId: BuildableId
  resourceSellPrice: number | null
  population: number
  populationMax: number
  // NEU: Zustand des Gebäudes (0..100). Optional → Bestands-Aufrufer brechen nicht.
  condition?: number
}

export interface SaleQuote {
  ertragswert: number       // nach Bestandsprämie UND Zustandsminderung
  rueckbau: number
  umsiedlung: number
  verdraengte: number
  valueNormal: number
  valueInstant: number
  isStrandedAsset: boolean
}

export function getSaleQuote(ctx: SaleContext): SaleQuote {
  const item = BUILDABLE_ITEMS[ctx.buildableId]
  const baukosten = item.cost
  const S = BUILDING_SALE

  let ertragswert: number
  let umsiedlung = 0
  let verdraengte = 0

  if (ctx.buildableId === 'habitat') {
    const auslastung =
      ctx.populationMax > 0
        ? Math.min(1, Math.max(0, ctx.population / ctx.populationMax))
        : 0
    ertragswert = Math.round(100 * auslastung * S.MIETWERT_PRO_PLATZ * S.FAKTOR)
    verdraengte = Math.max(0, ctx.population - (ctx.populationMax - 100))
    umsiedlung = verdraengte * S.UMSIEDLUNG_PRO_PERSON
  } else {
    const produktion = item.produces?.amount ?? 0
    const preis = ctx.resourceSellPrice ?? 0
    ertragswert = Math.round(produktion * preis * S.FAKTOR)
    if (preis > S.PROFIT_SCHWELLE) {
      ertragswert = Math.max(ertragswert, Math.round(baukosten * S.BESTAND_PREMIUM))
    }
  }

  // NEU: Wertminderung durch Abnutzung. Ein defektes Haus verkauft sich
  // schlechter (kann eher zum Stranded Asset werden). Rückbau bleibt gleich –
  // Abriss kostet unabhängig vom Zustand.
  ertragswert = Math.round(ertragswert * conditionFactor(ctx.condition ?? 100))

  const rueckbau = Math.round(baukosten * S.RUECKBAU_PCT) + umsiedlung
  const valueNormal = ertragswert - rueckbau
  const valueInstant = Math.floor(ertragswert * (1 - S.SOFORT_ABSCHLAG)) - rueckbau

  return {
    ertragswert, rueckbau, umsiedlung, verdraengte,
    valueNormal, valueInstant,
    isStrandedAsset: valueNormal < 0,
  }
}

// NEU: Reparatur eines Gebäudes auf condition 100 — gleiche Logik wie Module/Schiffe.
export function getBuildingRepairQuote(buildableId: BuildableId, condition: number) {
  return getRepairQuote(BUILDABLE_ITEMS[buildableId].cost, condition)
}
