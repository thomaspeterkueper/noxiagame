// lib/game/production/inputGate.ts
// Produktion nur mit Eingängen (Request coordination/open/20261027-0930-core-to-core-production-input-gating.md,
// NOXIA-MAT-0001, Thomas 28.10.2026: „richtiger Verbrauch“).
//
// Regel – dieselbe wie `runProcess` in lib/game/food/chain.ts: Ein Gebäude läuft in
// einem Tick nur, wenn alle seine Eingänge im Bestand liegen; dann verbraucht es sie
// und erzeugt seine Ausgänge. Fehlt ein Eingang, erzeugt es nichts, verbraucht nichts
// und meldet das fehlende Gut als Engpass.
//
// Reihenfolge bei mehreren Verbrauchern eines Guts am Ort: nach Gebäudekennung
// aufsteigend (deterministisch). Gebäude greifen vor dem Verbrauch der Bewohner auf
// den Bestand zu; Bewohner verbrauchen danach wie bisher, der Bestand fällt nie unter 0.
// Ausgänge eines Gebäudes stehen anderen Gebäuden erst im nächsten Tick zur Verfügung.

export interface GateBuilding { id: string; entity_id: string }
export interface GateDefinition { consumption: Array<{ resource: string; amount: number }> }

export interface GateResult {
  /** Gebäude, die in diesem Tick laufen */
  running: Set<string>
  /** Gebäude ohne Eingang → fehlendes Gut */
  limitedBy: Map<string, string>
  /** Verbrauch der laufenden Gebäude je Gut */
  consumed: Record<string, number>
  /** Bestand nach dem Verbrauch der Gebäude */
  stockAfter: Record<string, number>
}

export function gateProduction(buildings: readonly GateBuilding[], defs: ReadonlyMap<string, GateDefinition>, stock: Readonly<Record<string, number>>, resources?: readonly string[]): GateResult {
  const left: Record<string, number> = { ...stock }
  const running = new Set<string>()
  const limitedBy = new Map<string, string>()
  const consumed: Record<string, number> = {}
  const ordered = [...buildings].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  for (const building of ordered) {
    const def = defs.get(building.entity_id)
    if (!def) continue
    const inputs = def.consumption.filter(input => input.amount > 0 && (!resources || resources.includes(input.resource)))
    const missing = inputs.find(input => (left[input.resource] ?? 0) + 1e-9 < input.amount)
    if (missing) { limitedBy.set(building.id, missing.resource); continue }
    for (const input of inputs) {
      left[input.resource] = (left[input.resource] ?? 0) - input.amount
      consumed[input.resource] = (consumed[input.resource] ?? 0) + input.amount
    }
    running.add(building.id)
  }
  return { running, limitedBy, consumed, stockAfter: left }
}
