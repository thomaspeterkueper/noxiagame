// lib/game/colonyPressure.ts
// NOXIA Playability #17 — minimal deterministic pressure adapter.
// This is not the full problem engine. It exposes causal state to person decisions.

import type { ColonyPressure } from './personBrain'

function clamp01(v: number): number { return Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0)) }

export interface LocationPressureSnapshot {
  locationId: string
  population: number
  populationMax: number
  supplied: boolean
  resources: Array<{ resource: string; stock: number; production: number; consumption: number }>
}

export function derivePressures(snapshot: LocationPressureSnapshot): ColonyPressure[] {
  const out: ColonyPressure[] = []
  for (const r of snapshot.resources) {
    const consumption = Math.max(0, Number(r.consumption ?? 0))
    const production = Math.max(0, Number(r.production ?? 0))
    const stock = Math.max(0, Number(r.stock ?? 0))
    if (r.resource !== 'water' && r.resource !== 'energy') continue

    // Coverage is expressed in ticks at current net demand. Falling stock with
    // no net demand still creates a mild signal, not an artificial emergency.
    const netDemand = Math.max(0, consumption - production)
    const coverage = netDemand > 0 ? stock / netDemand : (consumption > 0 ? stock / consumption : 99)
    let severity = 0
    if (coverage < 1) severity = 1
    else if (coverage < 2) severity = 0.85
    else if (coverage < 4) severity = 0.65
    else if (coverage < 8) severity = 0.40
    else if (stock < 50) severity = 0.25

    if (severity > 0) out.push({
      code: r.resource,
      severity: clamp01(severity),
      subjectRef: `${snapshot.locationId}:${r.resource}`,
      reason: `stock=${stock}, production=${production}, consumption=${consumption}, coverageTicks=${Number.isFinite(coverage) ? coverage.toFixed(2) : 'inf'}`,
    })
  }

  if (snapshot.populationMax > 0) {
    const occupancy = snapshot.population / snapshot.populationMax
    const severity = occupancy >= 1 ? 0.9 : occupancy >= 0.95 ? 0.65 : occupancy >= 0.85 ? 0.35 : 0
    if (severity > 0) out.push({ code: 'habitat', severity, subjectRef: `${snapshot.locationId}:habitat`, reason: `occupancy=${occupancy.toFixed(3)}` })
  }

  if (!snapshot.supplied) {
    // Broad safety signal; kept below direct water emergency severity.
    out.push({ code: 'medical', severity: 0.45, subjectRef: `${snapshot.locationId}:supply-health`, reason: 'location.is_supplied=false' })
  }
  return out.sort((a, b) => (b.severity - a.severity) || a.code.localeCompare(b.code))
}

export async function loadColonyPressures(supabase: any): Promise<Map<string, ColonyPressure[]>> {
  const result = new Map<string, ColonyPressure[]>()
  const { data: locations } = await supabase.from('locations').select('id, population, population_max, is_supplied').eq('simulate_tick', true)
  for (const loc of locations ?? []) {
    const { data: rows } = await supabase.from('location_resources').select('resource, stock, production, consumption').eq('location_id', loc.id)
    result.set(loc.id, derivePressures({
      locationId: loc.id,
      population: Number(loc.population ?? 0),
      populationMax: Number(loc.population_max ?? 0),
      supplied: Boolean(loc.is_supplied),
      resources: (rows ?? []).map((r: any) => ({ resource: r.resource, stock: Number(r.stock ?? 0), production: Number(r.production ?? 0), consumption: Number(r.consumption ?? 0) })),
    }))
  }
  return result
}
