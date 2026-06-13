// app/dashboard/dashboardStatus.ts
// Reine Ableitungen für das Übersichts-Layout.
// Nur aus resource / stock / production / consumption — keine anderen Felder.
// Defensiv: fehlende production/consumption → 0.
//
// Status (Vorgabe Thomas, 07.06.):
//   netto = production − consumption
//   kritisch: stock <= 0  ODER  (netto < 0 und stock/|netto| <= 3 Ticks)
//   knapp:    netto < 0 und stock/|netto| <= 8 Ticks
//   stabil:   netto >= 0  ODER  Vorrat reicht länger als 8 Ticks
//   consumption == 0 → nie kritisch/knapp wegen Verbrauch
//
// „reicht noch ~N Ticks" ist die einzige tick-abhängige Größe — ehrlich
// als ~ beschriftet, bis Lazy Ticks (0.1.5) die Tickdauer auf Stunden bringt.

export type ResourceState = 'critical' | 'low' | 'stable' | 'surplus'

export interface ResourceStatus {
  resource:   string
  stock:      number
  netto:      number          // production − consumption
  state:      ResourceState
  ticksLeft:  number | null   // bei Defizit: floor(stock / |netto|), sonst null
}

const CRITICAL_TICKS = 3
const LOW_TICKS = 8

export function resourceStatus(r: {
  resource: string; stock?: number; production?: number; consumption?: number
}): ResourceStatus {
  const stock       = r.stock ?? 0
  const production  = r.production ?? 0
  const consumption = r.consumption ?? 0
  const netto       = production - consumption

  let ticksLeft: number | null = null
  if (netto < 0) ticksLeft = stock > 0 ? Math.floor(stock / Math.abs(netto)) : 0

  let state: ResourceState
  if (stock <= 0 && consumption > 0) {
    state = 'critical'
  } else if (netto >= 0) {
    state = netto > 0 ? 'surplus' : 'stable'
  } else if (ticksLeft !== null && ticksLeft <= CRITICAL_TICKS) {
    state = 'critical'
  } else if (ticksLeft !== null && ticksLeft <= LOW_TICKS) {
    state = 'low'
  } else {
    state = 'stable'
  }

  return { resource: r.resource, stock, netto, state, ticksLeft }
}

// Rangfolge für „kritischster Status zuerst"
const SEVERITY: Record<ResourceState, number> = {
  critical: 0, low: 1, stable: 2, surplus: 3,
}

// Wichtigster Engpass einer Kolonie = kritischster Ressourcenstatus.
// Gibt null zurück, wenn alles stabil/Überschuss ist.
export function worstStatus(loc: any): ResourceStatus | null {
  const all = (loc.location_resources ?? []).map(resourceStatus)
  all.sort((a: ResourceStatus, b: ResourceStatus) => SEVERITY[a.state] - SEVERITY[b.state])
  const worst = all[0]
  if (!worst || worst.state === 'stable' || worst.state === 'surplus') return null
  return worst
}

export function stateColor(state: ResourceState, T: Record<string, string>): string {
  switch (state) {
    case 'critical': return T.red
    case 'low':      return '#d08020'
    case 'surplus':  return T.green
    case 'stable':   return T.green
  }
}

const RES_LABEL: Record<string, string> = { water: 'Wasser', energy: 'Energie', metal: 'Metall' }

export function stateLabel(s: ResourceStatus): string {
  const name = RES_LABEL[s.resource] ?? s.resource
  switch (s.state) {
    case 'critical': return s.ticksLeft === 0 ? `${name} aufgebraucht` : `${name} kritisch`
    case 'low':      return `${name} wird knapp`
    case 'surplus':  return `${name} Überschuss`
    case 'stable':   return `${name} stabil`
  }
}

// Priorisierte Aufmerksamkeits-Hinweise über alle Kolonien.
// LENKT nur — nennt das Problem, nie die Lösung (kein Betrag, kein „liefere X").
export interface Attention {
  level: 'critical' | 'warning'
  slug:  string
  text:  string
}

export function attentionItems(locations: any[]): Attention[] {
  const items: Attention[] = []

  for (const loc of locations ?? []) {
    for (const r of loc.location_resources ?? []) {
      const s = resourceStatus(r)
      const name = RES_LABEL[r.resource] ?? r.resource
      if (s.state === 'critical') {
        items.push({
          level: 'critical', slug: loc.slug,
          text: s.ticksLeft === 0
            ? `${loc.name}: ${name} aufgebraucht`
            : `${loc.name}: ${name} kritisch — reicht noch ~${s.ticksLeft} Ticks`,
        })
      } else if (s.state === 'low') {
        items.push({
          level: 'warning', slug: loc.slug,
          text: `${loc.name}: ${name} wird knapp — reicht noch ~${s.ticksLeft} Ticks`,
        })
      }
    }
    if (loc.population > loc.population_max) {
      items.push({
        level: 'warning', slug: loc.slug,
        text: `${loc.name}: Überbevölkerung — Wohnraum fehlt`,
      })
    }
  }

  return items.sort((a, b) =>
    (a.level === 'critical' ? 0 : 1) - (b.level === 'critical' ? 0 : 1)
  )
}
