// lib/game/economy/facilityOperation.ts
// Erstellt:     06.11.2026
// Aktualisiert: 06.11.2026 — Förderanlagen brauchen Bedienung (Mensch oder Roboter), Förderabgabe je Ort
// Version:      1.0.0
//
// Rein, ohne DB. Entschieden (Thomas, 06.11.2026, NOXIA-FIN-0002 Frage 1 und 3):
//   „das sollte ein flexibler Wert sein“ – Förderabgabe je Ort (colony_settings.extraction_tax_rate).
//   „statt Menschen kann man auch Roboter kaufen, jeder muss selbst entscheiden, was sich mehr lohnt.“
// SQL-Seite: Migration 20261106020000_extraction_tax_and_facility_operation.sql (run_facility_operation).

/** Wie viele Anlagen ein Mensch oder Roboter bedient. */
export const FACILITIES_PER_OPERATOR: Record<string, number> = { ice_drill: 4, water_recycler: 1, mine: 1 }

/** Ab diesem Tick stehen unbediente Anlagen von Firmen still (eine Woche Vorlauf ab 06.11.2026). */
export const OPERATION_REQUIRED_FROM_TICK = 2968

export const ROBOT_PRICE = 4000
export const ROBOT_UPKEEP_PER_DAY = 25
/** Über so viele Tage rechnet eine Firma, ob Mensch oder Roboter günstiger ist. */
export const DECISION_HORIZON_DAYS = 60

export function operatorsNeeded(kind: string, facilities: number): number {
  const per = FACILITIES_PER_OPERATOR[kind]
  if (!per || facilities <= 0) return 0
  return Math.ceil(facilities / per)
}

/** Kosten über den Planungszeitraum: Mensch (Lohn) gegen Roboter (Kauf + Wartung). */
export function operatorCosts(dailyWage: number, days = DECISION_HORIZON_DAYS) {
  const staff = Math.max(0, dailyWage) * days
  const robot = ROBOT_PRICE + ROBOT_UPKEEP_PER_DAY * days
  return { staff, robot, cheaper: staff <= robot ? 'staff' as const : 'robot' as const }
}

export type FirmBuilding = { entity_id: string; location_id: string; location: string; tile_col: number }

/**
 * Welche Anlagen einer Firma laufen: je Ort und Art nur so viele, wie Bedienung da ist
 * (Menschen × Anlagen je Mensch + Roboter × Anlagen je Roboter). Andere Gebäude laufen immer.
 * Vor OPERATION_REQUIRED_FROM_TICK laufen alle.
 */
export function operatedBuildings(buildings: FirmBuilding[], operators: Map<string, number>, tick: number): FirmBuilding[] {
  if (tick < OPERATION_REQUIRED_FROM_TICK) return buildings
  const groups = new Map<string, FirmBuilding[]>()
  const out: FirmBuilding[] = []
  for (const b of buildings) {
    if (!FACILITIES_PER_OPERATOR[b.entity_id]) { out.push(b); continue }
    const key = `${b.location_id}|${b.entity_id}`
    groups.set(key, [...(groups.get(key) ?? []), b])
  }
  for (const [key, list] of groups) {
    const kind = key.split('|')[1]
    const allowed = (operators.get(key) ?? 0) * FACILITIES_PER_OPERATOR[kind]
    out.push(...[...list].sort((a, b) => a.tile_col - b.tile_col).slice(0, allowed))
  }
  return out
}

/** Förderabgabe auf einen Erlös, ganze Credits. */
export function extractionTax(revenue: number, rate: number): number {
  if (!(revenue > 0) || !(rate > 0)) return 0
  return Math.min(Math.round(revenue), Math.round(revenue * Math.min(1, rate)))
}
