// lib/game/buildingSale.ts
// Marktwertbasierte Gebäudebewertung (siehe SPEC_gebaeude-verkauf.md)
// Reine Funktionen ohne DB-Zugriff – testbar und vom Client wiederverwendbar.

import { BUILDABLE_ITEMS } from './config'

export const BUILDING_SALE = {
  FAKTOR: 20,                 // Kapitalisierungsmultiplikator
  RUECKBAU_PCT: 0.20,         // Rückbau = 20% der Baukosten
  BESTAND_PREMIUM: 1.05,      // Untergrenze profitabler Gebäude
  MIETWERT_PRO_PLATZ: 1,      // Cr/Tick pro belegtem Habitat-Platz
  UMSIEDLUNG_PRO_PERSON: 5,   // Cr pro verdrängtem Einwohner
  VERKAUFSDAUER_TICKS: 2,     // Regulärer Verkauf dauert 2 Ticks
  SOFORT_ABSCHLAG: 0.15,      // Sofortverkauf: 15% Abschlag auf Ertragswert
  // Schwelle, ab der ein Gut als "profitabel" gilt und die
  // Bestandsprämien-Untergrenze greift. Bewusst über PRICE_MIN (10):
  PROFIT_SCHWELLE: 15,
} as const

export type BuildableId = 'mine' | 'solar' | 'habitat'
export type SaleMode = 'normal' | 'instant'

export interface SaleContext {
  buildableId: BuildableId
  // Verkaufspreis (sell_price) des produzierten Guts am Standort.
  // Für habitat irrelevant, null erlaubt.
  resourceSellPrice: number | null
  // Kolonie-Daten (nur für habitat relevant, sonst ignoriert):
  population: number
  populationMax: number
}

export interface SaleQuote {
  ertragswert: number       // vor Abschlägen, nach Bestandsprämien-Untergrenze
  rueckbau: number          // 20% Baukosten + ggf. Umsiedlung
  umsiedlung: number        // Anteil Umsiedlungskosten (informativ fürs UI)
  verdraengte: number       // betroffene Einwohner (informativ fürs UI)
  valueNormal: number       // Auszahlung bei regulärem Verkauf (2 Ticks)
  valueInstant: number      // Auszahlung bei Sofortverkauf
  isStrandedAsset: boolean  // valueNormal < 0
}

export function getSaleQuote(ctx: SaleContext): SaleQuote {
  const item = BUILDABLE_ITEMS[ctx.buildableId]
  const baukosten = item.cost
  const S = BUILDING_SALE

  let ertragswert: number
  let umsiedlung = 0
  let verdraengte = 0

  if (ctx.buildableId === 'habitat') {
    // Auslastungsbasiert: leere Habitate sind (fast) wertlos.
    const auslastung =
      ctx.populationMax > 0
        ? Math.min(1, Math.max(0, ctx.population / ctx.populationMax))
        : 0
    ertragswert = Math.round(100 * auslastung * S.MIETWERT_PRO_PLATZ * S.FAKTOR)

    // Verdrängte Einwohner: wie viele passen nach Abriss nicht mehr rein?
    verdraengte = Math.max(0, ctx.population - (ctx.populationMax - 100))
    umsiedlung = verdraengte * S.UMSIEDLUNG_PRO_PERSON
  } else {
    // Produktionsgebäude: Ertragswertverfahren.
    const produktion = item.produces?.amount ?? 0
    const preis = ctx.resourceSellPrice ?? 0
    ertragswert = Math.round(produktion * preis * S.FAKTOR)

    // Tobins-q-Untergrenze: profitables Bestandsgebäude nie unter Neubau.
    if (preis > S.PROFIT_SCHWELLE) {
      ertragswert = Math.max(ertragswert, Math.round(baukosten * S.BESTAND_PREMIUM))
    }
  }

  const rueckbau = Math.round(baukosten * S.RUECKBAU_PCT) + umsiedlung

  const valueNormal = ertragswert - rueckbau
  // Abschlag nur auf den Ertragswert – Rückbau wird nicht billiger,
  // nur weil man es eilig hat.
  const valueInstant = Math.floor(ertragswert * (1 - S.SOFORT_ABSCHLAG)) - rueckbau

  return {
    ertragswert,
    rueckbau,
    umsiedlung,
    verdraengte,
    valueNormal,
    valueInstant,
    isStrandedAsset: valueNormal < 0,
  }
}
