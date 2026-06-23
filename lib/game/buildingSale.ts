// lib/game/buildingSale.ts
// Erstellt: 31.05.2026
// Aktualisiert: 22.06.2026 — DBBuildingDef von BuildingDef (types.ts) getrennt
// Version:      2.1.0
//
// Marktwertbasierte Gebäudebewertung.
// Reine Funktionen ohne DB-Zugriff — testbar und vom Client wiederverwendbar.
//
// Zwei Interfaces:
//   DBBuildingDef  — schlanker DB-Typ (building_definitions-Spalten)
//                    wird von build/route.ts und tick.ts befüllt
//   BuildingDef    — re-export aus buildings/types.ts (reichhaltiger UI-Typ)

export { type BuildingDef } from './buildings/types'
import { conditionFactor, getRepairQuote } from './condition'

export const BUILDING_SALE = {
  FAKTOR: 20,
  RUECKBAU_PCT: 0.20,
  BESTAND_PREMIUM: 1.05,
  MIETWERT_PRO_PLATZ: 1,
  UMSIEDLUNG_PRO_PERSON: 5,
  VERKAUFSDAUER_TICKS: 2,
  SOFORT_ABSCHLAG: 0.15,
  PROFIT_SCHWELLE: 15,
} as const

export type BuildableId = string
export type SaleMode = 'normal' | 'instant'

// Schlankes Interface für DB-Lookups (build/route.ts, tick.ts)
// Spiegelt die Spalten von building_definitions 1:1 wider.
export interface DBBuildingDef {
  cost_credits:     number
  population_bonus: number
  production:       { resource: string; amount: number }[]
  consumption:      { resource: string; amount: number }[]
}

export interface SaleContext {
  buildableId:       BuildableId
  def:               DBBuildingDef
  resourceSellPrice: number | null
  population:        number
  populationMax:     number
  condition?:        number  // 0..100, Default 100
}

export interface SaleQuote {
  ertragswert:     number
  rueckbau:        number
  umsiedlung:      number
  verdraengte:     number
  valueNormal:     number
  valueInstant:    number
  isStrandedAsset: boolean
}

export function getSaleQuote(ctx: SaleContext): SaleQuote {
  const { def } = ctx
  const baukosten = def.cost_credits
  const S = BUILDING_SALE

  let ertragswert: number
  let umsiedlung = 0
  let verdraengte = 0

  if (def.population_bonus > 0) {
    const auslastung =
      ctx.populationMax > 0
        ? Math.min(1, Math.max(0, ctx.population / ctx.populationMax))
        : 0
    ertragswert = Math.round(def.population_bonus * auslastung * S.MIETWERT_PRO_PLATZ * S.FAKTOR)
    verdraengte = Math.max(0, ctx.population - (ctx.populationMax - def.population_bonus))
    umsiedlung = verdraengte * S.UMSIEDLUNG_PRO_PERSON
  } else {
    const hauptproduktion = def.production[0]
    const produktion = hauptproduktion?.amount ?? 0
    const preis = ctx.resourceSellPrice ?? 0
    ertragswert = Math.round(produktion * preis * S.FAKTOR)
    if (preis > S.PROFIT_SCHWELLE) {
      ertragswert = Math.max(ertragswert, Math.round(baukosten * S.BESTAND_PREMIUM))
    }
  }

  ertragswert = Math.round(ertragswert * conditionFactor(ctx.condition ?? 100))

  const rueckbau     = Math.round(baukosten * S.RUECKBAU_PCT) + umsiedlung
  const valueNormal  = ertragswert - rueckbau
  const valueInstant = Math.floor(ertragswert * (1 - S.SOFORT_ABSCHLAG)) - rueckbau

  return {
    ertragswert, rueckbau, umsiedlung, verdraengte,
    valueNormal, valueInstant,
    isStrandedAsset: valueNormal < 0,
  }
}

export function getBuildingRepairQuote(def: DBBuildingDef, condition: number) {
  return getRepairQuote(def.cost_credits, condition)
}
