// lib/game/merchantQualification.ts
// Erstellt:     09.10.2026 — Handelsstufen: erst über fremde Schiffe, später mit eigenem Schiff
// Version:      1.0.0
//
// Eine Quelle für die Frage „Darf dieser Spieler ein eigenes Handelsschiff
// führen?". Genutzt vom Händlerweg (Journey), von der Werft-Anzeige und von
// der Schiffskauf-Route. Reine Ableitung aus vorhandenen Zeilen
// (trade_transactions, player_learning_progress) – kein eigener Zustand.

/** Verkäufe an einem anderen Ort als dem Einkaufsort, die als Handelserfahrung zählen. */
export const MERCHANT_EXPERIENCE_SALES = 5

/** Kaufmännische Grundausbildung = so viele verschiedene abgeschlossene Wirtschafts-Grundmodule (ECO-L0-…). */
export const COMMERCIAL_BASICS_MODULES = 3

/** Wirtschafts-Grundmodul (ECO-L0-…), unabhängig vom ID-Präfix. */
export function isCommercialBasicsModule(moduleId: string): boolean {
  return /(^|:)ECO-L0-\d+$/.test(moduleId)
}

export type MerchantTrade = {
  resource: string
  from_location: string | null
  profit: number | null
  traded_at: string
}

export type MerchantStanding = {
  purchases: number
  /** Verkäufe mit Erlös, deren Ware zuvor an einem anderen Standort eingekauft wurde. */
  salesElsewhere: number
  /** Anzahl verschiedener abgeschlossener Wirtschafts-Grundmodule. */
  commercialBasicsCompleted: number
  hasCommercialBasics: boolean
  hasExperience: boolean
  /** Erfahrung ODER Grundausbildung. */
  qualified: boolean
}

// Einkäufe stehen mit negativem, Verkäufe mit positivem profit im Journal
// (noxia_spot_trade). Ein Verkauf zählt als Fernhandel, wenn dieselbe Ware
// vorher an einem anderen Standort eingekauft wurde.
export function merchantStanding(trades: MerchantTrade[], completedModuleIds: string[]): MerchantStanding {
  const sorted = [...trades].sort((a, b) => a.traded_at.localeCompare(b.traded_at))
  const boughtAt = new Map<string, Set<string>>()
  let purchases = 0
  let salesElsewhere = 0

  for (const t of sorted) {
    const profit = Number(t.profit ?? 0)
    const loc = t.from_location ?? ''
    if (profit < 0) {
      purchases += 1
      const set = boughtAt.get(t.resource) ?? new Set<string>()
      set.add(loc)
      boughtAt.set(t.resource, set)
    } else if (profit > 0) {
      const origins = boughtAt.get(t.resource)
      if (origins && [...origins].some(origin => origin !== loc)) salesElsewhere += 1
    }
  }

  // Nach der laufenden Nummer zählen, damit dasselbe Modul unter zwei ID-Schreibweisen nicht doppelt zählt.
  const basics = new Set(completedModuleIds.filter(isCommercialBasicsModule).map(id => Number(id.slice(id.lastIndexOf('-') + 1))))
  const commercialBasicsCompleted = basics.size
  const hasCommercialBasics = commercialBasicsCompleted >= COMMERCIAL_BASICS_MODULES
  const hasExperience = salesElsewhere >= MERCHANT_EXPERIENCE_SALES
  return { purchases, salesElsewhere, commercialBasicsCompleted, hasCommercialBasics, hasExperience, qualified: hasExperience || hasCommercialBasics }
}
